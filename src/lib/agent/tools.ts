import { PayPalAgentToolkit } from '@paypal/agent-toolkit/ai-sdk';
import { tool, type Tool } from 'ai';
import { and, desc, eq, inArray } from 'drizzle-orm';
import { z } from 'zod';
import { requestAction } from '@/lib/actions/request';
import { addDays, demoNow, isoDate } from '@/lib/clock';
import { getDb } from '@/lib/db/client';
import { clients, collaborators, invoices, pendingActions, splits } from '@/lib/db/schema';
import { env } from '@/lib/env';
import { formatUsd } from '@/lib/money';
import { describePayPalError } from '@/lib/paypal/http';
import { createDraftInvoice, getInvoice, payerViewUrl } from '@/lib/paypal/invoicing';
import { getCashflow } from '@/lib/queries/cashflow';
import { getSettings } from '@/lib/settings/store';
import { draftReminder } from './draft';
import { parseSplitInput, resolveClient } from './resolve';
import { draftContextFor, rescoreOpenInvoices } from './triage';

const toneSchema = z.enum(['gentle', 'friendly_firm', 'firm']);

/** Read-only PayPal tools from the official Agent Toolkit. Sends never come from here: they must pass the policy gate. */
function paypalReadTools(): Record<string, Tool> {
  try {
    const e = env();
    const toolkit = new PayPalAgentToolkit({
      clientId: e.PAYPAL_CLIENT_ID,
      clientSecret: e.PAYPAL_CLIENT_SECRET,
      configuration: { actions: { invoices: { list: true, get: true } }, context: { sandbox: true } },
    });
    return toolkit.getTools();
  } catch (err) {
    console.warn('[agent] PayPal Agent Toolkit unavailable, using built-in read tools:', err);
    return {
      get_invoice: tool({
        description: 'Get a PayPal invoice by its PayPal id (INV2-...)',
        parameters: z.object({ invoice_id: z.string() }),
        execute: async ({ invoice_id }) => getInvoice(invoice_id),
      }),
    };
  }
}

async function safe<T>(fn: () => Promise<T>): Promise<T | { error: string }> {
  try {
    return await fn();
  } catch (e) {
    return { error: describePayPalError(e) };
  }
}

export function buildTools(): Record<string, Tool> {
  const db = getDb();

  return {
    ...paypalReadTools(),

    get_risk_report: tool({
      description: 'Open invoices ranked by late-payment risk (highest first), with the factors behind each score.',
      parameters: z.object({}),
      execute: () => safe(async () => {
        const open = await rescoreOpenInvoices();
        return open
          .sort((a, b) => b.risk.score - a.risk.score)
          .map((r) => ({
            client: r.client.name,
            invoice: r.invoice.number,
            amount: formatUsd(r.invoice.amountCents),
            daysOverdue: r.features.daysOverdue,
            riskScore: r.risk.score,
            tone: r.risk.tone,
            factors: r.risk.factors.map((f) => f.label),
            explanation: r.invoice.riskExplanation,
          }));
      }),
    }),

    get_client_profile: tool({
      description: 'Payment history and invoices for one client (fuzzy name match).',
      parameters: z.object({ clientName: z.string() }),
      execute: ({ clientName }) => safe(async () => {
        const all = await db.select().from(clients);
        const r = resolveClient(clientName, all);
        if (!r.ok) return { error: r.error };
        const inv = await db.select().from(invoices).where(eq(invoices.clientId, r.client.id));
        return {
          name: r.client.name,
          history: r.client.historyNote,
          avgDaysLate: r.client.avgDaysLate,
          pctPaidLate: Math.round(r.client.pctPaidLate * 100),
          ignoredReminders: r.client.ignoredReminders,
          invoices: inv.map((i) => ({ number: i.number, amount: formatUsd(i.amountCents), dueDate: i.dueDate, status: i.status, riskScore: i.riskScore, remindersSent: i.remindersSent })),
          note: 'History is demo data.',
        };
      }),
    }),

    draft_reminder: tool({
      description: "Draft a payment reminder for a client's most overdue open invoice and submit it through the autopilot rules (it may send automatically or wait for approval).",
      parameters: z.object({ clientName: z.string(), tone: toneSchema.optional().describe('Override the tone picked from the risk score') }),
      execute: ({ clientName, tone }) => safe(async () => {
        const open = await rescoreOpenInvoices();
        const r = resolveClient(clientName, open.map((o) => ({ id: o.client.id, name: o.client.name })).filter((c, i, a) => a.findIndex((x) => x.id === c.id) === i));
        if (!r.ok) return { error: r.error.replace('No client', 'No client with an open invoice') };
        const target = open.filter((o) => o.client.id === r.client.id).sort((a, b) => b.features.daysOverdue - a.features.daysOverdue)[0];
        const [queued] = await db
          .select()
          .from(pendingActions)
          .where(and(eq(pendingActions.invoiceId, target.invoice.id), eq(pendingActions.status, 'queued')));
        if (queued) await db.update(pendingActions).set({ status: 'skipped', error: 'Replaced by a new draft from chat' }).where(eq(pendingActions.id, queued.id));
        const useTone = tone ?? target.risk.tone;
        const draft = await draftReminder(draftContextFor(target.invoice, target.client, target.risk, useTone));
        const res = await requestAction({
          type: 'send_reminder', invoiceId: target.invoice.id, tone: useTone, subject: draft.subject, body: draft.body, reason: draft.explanation, usedFallback: draft.usedFallback,
        });
        return { invoice: target.invoice.number, tone: useTone, ...res, subject: draft.subject, body: draft.body };
      }),
    }),

    create_invoice: tool({
      description: 'Create a new PayPal invoice for an existing client, optionally splitting the payment with collaborators. The draft is created immediately; sending it goes through the autopilot rules.',
      parameters: z.object({
        clientName: z.string(),
        amountUsd: z.number().positive(),
        description: z.string().min(1),
        dueInDays: z.number().int().min(0).max(120),
        splits: z.array(z.object({ collaboratorName: z.string(), percent: z.number().int().min(1).max(100) })).optional(),
      }),
      execute: (input) => safe(async () => {
        const { demoBatch } = await getSettings();
        if (!demoBatch) return { error: 'The demo has not been set up yet. Reset the demo from Settings first.' };
        const r = resolveClient(input.clientName, await db.select().from(clients));
        if (!r.ok) return { error: r.error };
        const allCollabs = await db.select().from(collaborators);
        const parsed = parseSplitInput(input.splits ?? [], allCollabs);
        if (!parsed.ok) return { error: parsed.error };

        const existing = await db.select({ number: invoices.number }).from(invoices).where(eq(invoices.demoBatch, demoBatch));
        const next = Math.max(0, ...existing.map((x) => Number(x.number.split('-').pop()) || 0)) + 1;
        const number = `${demoBatch}-${next}`;
        const now = demoNow();
        const amountCents = Math.round(input.amountUsd * 100);
        const { id } = await createDraftInvoice({
          number,
          recipientEmail: r.client.paypalEmail,
          recipientName: r.client.name,
          description: input.description,
          amountCents,
          invoiceDate: isoDate(now),
          dueDate: isoDate(addDays(now, input.dueInDays)),
        });
        const live = await getInvoice(id);
        const [row] = await db.insert(invoices).values({
          paypalId: id, number, clientId: r.client.id, amountCents, description: input.description,
          issueDate: isoDate(now), dueDate: isoDate(addDays(now, input.dueInDays)), status: live.status, demoBatch, payerViewUrl: payerViewUrl(live),
        }).returning();
        if (parsed.splits.length) await db.insert(splits).values(parsed.splits.map((s) => ({ ...s, invoiceId: row.id })));
        const res = await requestAction({ type: 'send_invoice', invoiceId: row.id, tone: null, subject: null, body: null, reason: 'Created from chat' });
        const names = new Map(allCollabs.map((c) => [c.id, c.name]));
        return {
          invoiceNumber: number,
          amount: formatUsd(amountCents),
          splits: parsed.splits.map((s) => `${names.get(s.collaboratorId)} ${s.percent}%`),
          ...res,
        };
      }),
    }),

    get_cashflow: tool({
      description: 'Cash received this month, expected in the next 30 days, amount at risk, and collaborator payouts.',
      parameters: z.object({}),
      execute: () => safe(async () => {
        const c = await getCashflow();
        return {
          receivedThisMonth: formatUsd(c.receivedThisMonthCents),
          expectedNext30Days: formatUsd(c.expectedNext30Cents),
          atRisk: formatUsd(c.atRiskCents),
          paidOutToCollaborators: formatUsd(c.paidOutCents),
          recentPayouts: c.payouts.slice(0, 5).map((p) => `${p.collaboratorName} ${formatUsd(p.amountCents)} (${p.status}) for ${p.invoiceNumber}`),
        };
      }),
    }),

    list_pending_actions: tool({
      description: 'Actions waiting for the user\'s approval on the Today page.',
      parameters: z.object({}),
      execute: () => safe(async () => {
        const rows = await db
          .select({ action: pendingActions, invoice: invoices, client: clients })
          .from(pendingActions)
          .innerJoin(invoices, eq(pendingActions.invoiceId, invoices.id))
          .innerJoin(clients, eq(invoices.clientId, clients.id))
          .where(inArray(pendingActions.status, ['queued', 'failed']))
          .orderBy(desc(pendingActions.createdAt));
        return rows.map((r) => ({
          id: r.action.id, type: r.action.type, client: r.client.name, invoice: r.invoice.number, tone: r.action.tone, status: r.action.status, why: r.action.gateReason,
        }));
      }),
    }),
  };
}
