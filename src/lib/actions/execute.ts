import { and, eq } from 'drizzle-orm';
import { logActivity } from '@/lib/activity/log';
import { demoNow } from '@/lib/clock';
import { getDb } from '@/lib/db/client';
import { clients, invoices, pendingActions } from '@/lib/db/schema';
import { describePayPalError } from '@/lib/paypal/http';
import { getInvoice, sendInvoice } from '@/lib/paypal/invoicing';
import { deliverReminder } from '@/lib/reminders/deliver';
import { syncInvoices } from '@/lib/sync/invoices';
import { TONE_LABEL, type ActionStatus, type Tone } from '@/lib/types';
import { canExecute } from './can-execute';

async function finish(id: number, status: ActionStatus, error: string | null = null) {
  await getDb().update(pendingActions).set({ status, error, decidedAt: new Date() }).where(eq(pendingActions.id, id));
}

/** Runs a queued action exactly once: the atomic queued→executing claim makes double clicks harmless. */
export async function executeAction(id: number, by: 'rule' | 'user', edits?: { subject?: string; body?: string }): Promise<ActionStatus> {
  const db = getDb();
  const [claimed] = await db
    .update(pendingActions)
    .set({ status: 'executing', decidedBy: by, decidedAt: new Date(), ...(edits?.subject ? { subject: edits.subject } : {}), ...(edits?.body ? { body: edits.body } : {}) })
    .where(and(eq(pendingActions.id, id), eq(pendingActions.status, 'queued')))
    .returning();
  if (!claimed) {
    const [current] = await db.select({ status: pendingActions.status }).from(pendingActions).where(eq(pendingActions.id, id));
    return (current?.status ?? 'skipped') as ActionStatus;
  }

  const [row] = await db
    .select({ invoice: invoices, client: clients })
    .from(invoices)
    .innerJoin(clients, eq(invoices.clientId, clients.id))
    .where(eq(invoices.id, claimed.invoiceId));
  const actor = by === 'rule' ? 'rule' : 'user';

  try {
    const live = await getInvoice(row.invoice.paypalId);
    const check = canExecute(claimed, live.status, { lastReminderAt: row.invoice.lastReminderAt, now: demoNow() });
    if (!check.ok) {
      await finish(id, 'skipped', check.reason);
      await logActivity({ actor, action: 'action_skipped', summary: `Skipped ${claimed.type.replace('_', ' ')} for ${row.client.name}`, reason: check.reason, invoiceId: row.invoice.id });
      return 'skipped';
    }
    if (claimed.type === 'send_reminder') {
      const { emailed } = await deliverReminder(row.invoice.id, { subject: claimed.subject ?? '', body: claimed.body ?? '' });
      await finish(id, 'sent');
      await logActivity({
        actor,
        action: 'reminder_sent',
        summary: `Sent ${TONE_LABEL[(claimed.tone ?? 'gentle') as Tone]} reminder to ${row.client.name} for ${row.invoice.number}${emailed ? '' : ' (PayPal only)'}`,
        reason: by === 'rule' ? claimed.gateReason : 'Approved by you',
        invoiceId: row.invoice.id,
      });
    } else {
      await sendInvoice(row.invoice.paypalId);
      await finish(id, 'sent');
      await logActivity({ actor, action: 'invoice_sent', summary: `Sent invoice ${row.invoice.number} to ${row.client.name}`, reason: by === 'rule' ? claimed.gateReason : 'Approved by you', invoiceId: row.invoice.id });
      // Best-effort cache refresh: the invoice is already sent, so a sync error must not mark this action failed.
      await syncInvoices().catch(() => {});
    }
    return 'sent';
  } catch (e) {
    const msg = describePayPalError(e);
    await finish(id, 'failed', msg);
    await logActivity({ actor: 'system', action: 'action_failed', summary: `Could not ${claimed.type.replace('_', ' ')} for ${row.client.name}`, reason: msg, invoiceId: row.invoice.id });
    return 'failed';
  }
}

export async function skipAction(id: number): Promise<void> {
  const db = getDb();
  const [row] = await db
    .update(pendingActions)
    .set({ status: 'skipped', decidedBy: 'user', decidedAt: new Date() })
    .where(and(eq(pendingActions.id, id), eq(pendingActions.status, 'queued')))
    .returning();
  if (row) await logActivity({ actor: 'user', action: 'action_skipped', summary: `Skipped ${row.type.replace('_', ' ')}`, reason: 'Skipped by you', invoiceId: row.invoiceId });
}

export async function retryAction(id: number): Promise<void> {
  await getDb()
    .update(pendingActions)
    .set({ status: 'queued', error: null })
    .where(and(eq(pendingActions.id, id), eq(pendingActions.status, 'failed')));
}
