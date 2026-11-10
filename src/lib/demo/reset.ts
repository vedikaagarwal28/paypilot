import { eq } from 'drizzle-orm';
import { logActivity } from '@/lib/activity/log';
import { addDays, demoNow, isoDate } from '@/lib/clock';
import { getDb } from '@/lib/db/client';
import { activity, agentRuns, clients, collaborators, invoices, payouts, pendingActions, splits } from '@/lib/db/schema';
import { env } from '@/lib/env';
import { cancelInvoice, createDraftInvoice, deleteDraftInvoice, getInvoice, payerViewUrl, recordPayment, sendInvoice } from '@/lib/paypal/invoicing';
import { getSettings, saveSettings } from '@/lib/settings/store';
import { DEFAULT_RULES } from '@/lib/types';
import { SEED_CLIENTS, SEED_COLLABORATORS, SEED_INVOICES } from './seed-data';

export class ResetCooldownError extends Error {
  constructor() {
    super('Demo was reset less than 5 minutes ago');
    this.name = 'ResetCooldownError';
  }
}

const COOLDOWN_MS = 5 * 60 * 1000;
const pad = (n: number) => String(n).padStart(2, '0');

function batchId(d: Date): string {
  return `PP${String(d.getUTCFullYear()).slice(2)}${pad(d.getUTCMonth() + 1)}${pad(d.getUTCDate())}${pad(d.getUTCHours())}${pad(d.getUTCMinutes())}`;
}

async function retireOldBatch(demoBatch: string) {
  const old = await getDb().select().from(invoices).where(eq(invoices.demoBatch, demoBatch));
  await Promise.all(old.map(async (inv) => {
    try {
      const live = await getInvoice(inv.paypalId);
      if (live.status === 'DRAFT') await deleteDraftInvoice(inv.paypalId);
      else if (['SENT', 'UNPAID', 'PARTIALLY_PAID', 'SCHEDULED'].includes(live.status)) await cancelInvoice(inv.paypalId);
    } catch {
      // Best effort: an invoice we can't cancel just stays in the sandbox.
    }
  }));
}

export async function resetDemo(opts: { force?: boolean } = {}): Promise<{ batch: string }> {
  const db = getDb();
  const e = env();
  const current = await getSettings();
  if (!opts.force && current.lastResetAt && Date.now() - current.lastResetAt.getTime() < COOLDOWN_MS) throw new ResetCooldownError();
  if (e.SANDBOX_BUYER_EMAILS.length < 3 || e.SANDBOX_COLLAB_EMAILS.length < 2) {
    throw new Error('Set SANDBOX_BUYER_EMAILS (3) and SANDBOX_COLLAB_EMAILS (2) before resetting the demo');
  }

  if (current.demoBatch) await retireOldBatch(current.demoBatch);
  for (const table of [activity, pendingActions, payouts, splits, invoices, agentRuns, clients, collaborators]) await db.delete(table);

  const now = demoNow();
  const batch = batchId(new Date());
  const clientRows = await db
    .insert(clients)
    .values(SEED_CLIENTS.map((c) => ({
      name: c.name,
      paypalEmail: e.SANDBOX_BUYER_EMAILS[c.buyerIndex],
      contactEmail: e.DEMO_INBOX_EMAIL || e.SANDBOX_BUYER_EMAILS[c.buyerIndex],
      avgDaysLate: c.avgDaysLate,
      pctPaidLate: c.pctPaidLate,
      ignoredReminders: c.ignoredReminders,
      typicalAmountCents: c.typicalAmountCents,
      historyNote: c.historyNote,
    })))
    .returning();
  const collabRows = await db
    .insert(collaborators)
    .values(SEED_COLLABORATORS.map((c) => ({ name: c.name, role: c.role, paypalEmail: e.SANDBOX_COLLAB_EMAILS[c.collabIndex], defaultPercent: c.defaultPercent })))
    .returning();

  // Sequential on purpose: keeps invoice numbers in order and stays well clear of sandbox rate limits.
  for (const [n, seed] of SEED_INVOICES.entries()) {
    const client = clientRows[seed.clientIndex];
    const number = `${batch}-${n + 1}`;
    const dueDate = isoDate(addDays(now, seed.dueInDays));
    const issueDate = isoDate(addDays(now, seed.dueInDays - 14));
    const { id } = await createDraftInvoice({
      number,
      recipientEmail: client.paypalEmail,
      recipientName: client.name,
      description: seed.description,
      amountCents: seed.amountCents,
      invoiceDate: issueDate,
      dueDate,
    });
    await sendInvoice(id);
    if (seed.paid) await recordPayment(id, seed.amountCents, isoDate(addDays(now, -seed.paid.daysAgo)));
    const live = await getInvoice(id);
    const [row] = await db
      .insert(invoices)
      .values({
        paypalId: id,
        number,
        clientId: client.id,
        amountCents: seed.amountCents,
        description: seed.description,
        issueDate,
        dueDate,
        status: live.status,
        remindersSent: seed.remindersSent,
        lastReminderAt: seed.lastReminderDaysAgo ? addDays(now, -seed.lastReminderDaysAgo) : null,
        paidAt: seed.paid ? addDays(now, -seed.paid.daysAgo) : null,
        demoBatch: batch,
        payerViewUrl: payerViewUrl(live),
      })
      .returning();
    if (seed.splits.length) {
      await db.insert(splits).values(seed.splits.map((s) => ({ invoiceId: row.id, collaboratorId: collabRows[s.collaboratorIndex].id, percent: s.percent })));
    }
  }

  await saveSettings({ rules: DEFAULT_RULES, demoBatch: batch, lastResetAt: new Date() });
  await logActivity({ actor: 'system', action: 'demo_reset', summary: 'Demo reset', reason: `New batch ${batch}: ${SEED_INVOICES.length} sandbox invoices created` });
  return { batch };
}
