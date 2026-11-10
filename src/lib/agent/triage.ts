import { and, eq, gt, isNull } from 'drizzle-orm';
import { logActivity } from '@/lib/activity/log';
import { PAID_STATUSES } from '@/lib/actions/can-execute';
import { requestAction } from '@/lib/actions/request';
import { daysBetween, demoNow } from '@/lib/clock';
import { getDb } from '@/lib/db/client';
import { agentRuns, clients, invoices, pendingActions } from '@/lib/db/schema';
import { featuresFor, scoreRisk } from '@/lib/risk/score';
import { getSettings } from '@/lib/settings/store';
import { syncInvoices } from '@/lib/sync/invoices';
import type { TriageSummary } from '@/lib/types';
import { draftReminder, type DraftContext } from './draft';

export class RunInProgressError extends Error {
  constructor() {
    super('Agent is already running');
    this.name = 'RunInProgressError';
  }
}

const CLOSED = [...PAID_STATUSES, 'CANCELLED', 'DRAFT'];
const REMIND_GAP_DAYS = 3;

/** Run `fn` over items with at most `limit` in flight. */
async function pool<T, R>(items: T[], limit: number, fn: (t: T) => Promise<R>): Promise<R[]> {
  const out: R[] = new Array(items.length);
  let next = 0;
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (next < items.length) {
      const i = next++;
      out[i] = await fn(items[i]);
    }
  }));
  return out;
}

/** Fresh risk score for every open invoice of the current demo batch (no drafting, no sending). */
export async function rescoreOpenInvoices() {
  const db = getDb();
  const { demoBatch } = await getSettings();
  if (!demoBatch) return [];
  const rows = await db
    .select({ invoice: invoices, client: clients })
    .from(invoices)
    .innerJoin(clients, eq(invoices.clientId, clients.id))
    .where(eq(invoices.demoBatch, demoBatch));
  const now = demoNow();
  const open = rows.filter((r) => !CLOSED.includes(r.invoice.status));
  for (const r of open) {
    const features = featuresFor(r.invoice, r.client, now);
    const risk = scoreRisk(features);
    await db.update(invoices).set({ riskScore: risk.score, riskTone: risk.tone, riskFactors: risk.factors }).where(eq(invoices.id, r.invoice.id));
    Object.assign(r.invoice, { riskScore: risk.score, riskTone: risk.tone, riskFactors: risk.factors });
    Object.assign(r, { features, risk });
  }
  return open as (typeof open[number] & { features: ReturnType<typeof featuresFor>; risk: ReturnType<typeof scoreRisk> })[];
}

export function draftContextFor(
  invoice: typeof invoices.$inferSelect,
  client: typeof clients.$inferSelect,
  risk: ReturnType<typeof scoreRisk>,
  tone = risk.tone,
): DraftContext {
  return {
    clientName: client.name,
    invoiceNumber: invoice.number,
    description: invoice.description,
    amountCents: invoice.amountCents,
    dueDate: invoice.dueDate,
    daysOverdue: daysBetween(new Date(`${invoice.dueDate}T00:00:00Z`), demoNow()),
    tone,
    factors: risk.factors,
    historyNote: client.historyNote,
    remindersSent: invoice.remindersSent,
  };
}

export async function runTriage(): Promise<TriageSummary> {
  const db = getDb();
  const [running] = await db
    .select()
    .from(agentRuns)
    .where(and(isNull(agentRuns.finishedAt), gt(agentRuns.startedAt, new Date(Date.now() - 2 * 60 * 1000))));
  if (running) throw new RunInProgressError();
  const [run] = await db.insert(agentRuns).values({}).returning();

  const summary: TriageSummary = { open: 0, needsAttention: 0, autoSent: 0, queued: 0, skippedRecent: 0 };
  try {
    await syncInvoices();
    const open = await rescoreOpenInvoices();
    summary.open = open.length;
    const queued = await db.select({ invoiceId: pendingActions.invoiceId }).from(pendingActions).where(eq(pendingActions.status, 'queued'));
    const hasQueued = new Set(queued.map((q) => q.invoiceId));
    const now = demoNow();

    const overdue = open.filter((r) => r.features.daysOverdue > 0);
    summary.needsAttention = overdue.length;
    const candidates = overdue.filter((r) => {
      const recent = r.invoice.lastReminderAt && daysBetween(r.invoice.lastReminderAt, now) < REMIND_GAP_DAYS;
      if (hasQueued.has(r.invoice.id) || recent) {
        summary.skippedRecent++;
        return false;
      }
      return true;
    });

    const results = await pool(candidates, 3, async (r) => {
      const draft = await draftReminder(draftContextFor(r.invoice, r.client, r.risk));
      await db.update(invoices).set({ riskExplanation: draft.explanation }).where(eq(invoices.id, r.invoice.id));
      return requestAction({
        type: 'send_reminder',
        invoiceId: r.invoice.id,
        tone: r.risk.tone,
        subject: draft.subject,
        body: draft.body,
        reason: draft.explanation,
        usedFallback: draft.usedFallback,
      });
    });
    summary.autoSent = results.filter((r) => r.auto && r.status === 'sent').length;
    summary.queued = results.filter((r) => r.status === 'queued').length;

    await logActivity({
      actor: 'agent',
      action: 'agent_run',
      summary: `Agent run: ${summary.open} open · ${summary.needsAttention} need attention · ${summary.autoSent} sent automatically · ${summary.queued} waiting for you`,
      payload: summary,
    });
    return summary;
  } finally {
    await db.update(agentRuns).set({ finishedAt: new Date(), summary }).where(eq(agentRuns.id, run.id));
  }
}
