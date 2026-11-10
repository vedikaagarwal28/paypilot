import { and, eq, inArray } from 'drizzle-orm';
import { logActivity } from '@/lib/activity/log';
import { PAID_STATUSES } from '@/lib/actions/can-execute';
import { demoNow } from '@/lib/clock';
import { getDb } from '@/lib/db/client';
import { clients, collaborators, invoices, payouts, splits } from '@/lib/db/schema';
import { formatUsd } from '@/lib/money';
import { describePayPalError } from '@/lib/paypal/http';
import { createPayoutBatch, getPayoutBatch } from '@/lib/paypal/payouts';
import { planPayouts } from '@/lib/splits/compute';

/**
 * Idempotent: safe to call from both the webhook and the polling sync, any number of times.
 * Payout rows are inserted before PayPal is called, and the unique (invoice, collaborator)
 * constraint means only the first caller gets rows back to pay.
 */
export async function handleInvoicePaid(paypalInvoiceId: string, source: 'webhook' | 'sync'): Promise<void> {
  const db = getDb();
  const [inv] = await db
    .select({ invoice: invoices, client: clients })
    .from(invoices)
    .innerJoin(clients, eq(invoices.clientId, clients.id))
    .where(eq(invoices.paypalId, paypalInvoiceId));
  if (!inv) return;
  const { invoice, client } = inv;

  if (!PAID_STATUSES.includes(invoice.status) || !invoice.paidAt) {
    await db.update(invoices).set({ status: 'PAID', paidAt: demoNow(), updatedAt: new Date() }).where(eq(invoices.id, invoice.id));
    await logActivity({
      actor: 'paypal',
      action: 'payment_received',
      summary: `Payment received: ${formatUsd(invoice.amountCents)} from ${client.name}`,
      reason: `Invoice ${invoice.number} marked paid (via ${source})`,
      invoiceId: invoice.id,
    });
  }

  const invoiceSplits = await db.select().from(splits).where(eq(splits.invoiceId, invoice.id));
  if (invoiceSplits.length === 0) return;
  const existing = await db.select({ collaboratorId: payouts.collaboratorId }).from(payouts).where(eq(payouts.invoiceId, invoice.id));
  const planned = planPayouts({ paypalId: invoice.paypalId, amountCents: invoice.amountCents }, invoiceSplits, existing);
  if (planned.length === 0) return;

  const senderBatchId = `paid-${invoice.paypalId}`;
  const inserted = await db
    .insert(payouts)
    .values(planned.map((p) => ({ invoiceId: invoice.id, collaboratorId: p.collaboratorId, amountCents: p.amountCents, senderBatchId, senderItemId: p.senderItemId })))
    .onConflictDoNothing()
    .returning();
  if (inserted.length === 0) return;

  const collabs = await db.select().from(collaborators).where(inArray(collaborators.id, inserted.map((p) => p.collaboratorId)));
  const byId = new Map(collabs.map((c) => [c.id, c]));
  const pct = new Map(invoiceSplits.map((s) => [s.collaboratorId, s.percent]));

  try {
    const batch = await createPayoutBatch({
      senderBatchId,
      emailSubject: 'You have a payout from PayPilot',
      items: inserted.map((p) => ({
        senderItemId: p.senderItemId,
        receiverEmail: byId.get(p.collaboratorId)!.paypalEmail,
        amountCents: p.amountCents,
        note: `Your ${pct.get(p.collaboratorId)}% share of ${invoice.number} (${client.name})`,
      })),
    });
    await db.update(payouts).set({ payoutBatchId: batch.payoutBatchId }).where(inArray(payouts.id, inserted.map((p) => p.id)));
    await logActivity({
      actor: 'agent',
      action: 'split_paid',
      summary: `Split paid: ${inserted.map((p) => `${byId.get(p.collaboratorId)!.name} ${formatUsd(p.amountCents)}`).join(', ')}`,
      reason: `Invoice ${invoice.number} paid; split rule ${invoiceSplits.map((s) => `${s.percent}%`).join(' / ')}`,
      invoiceId: invoice.id,
      payload: { payoutBatchId: batch.payoutBatchId },
    });
  } catch (e) {
    await db.update(payouts).set({ status: 'FAILED' }).where(inArray(payouts.id, inserted.map((p) => p.id)));
    await logActivity({ actor: 'paypal', action: 'payout_failed', summary: `Split payout failed for ${invoice.number}`, reason: describePayPalError(e), invoiceId: invoice.id });
  }
}

export async function refreshPayoutBatch(payoutBatchId: string): Promise<void> {
  const db = getDb();
  const batch = await getPayoutBatch(payoutBatchId);
  for (const item of batch.items) {
    const [row] = await db
      .select({ payout: payouts, collaborator: collaborators })
      .from(payouts)
      .innerJoin(collaborators, eq(payouts.collaboratorId, collaborators.id))
      .where(eq(payouts.senderItemId, item.senderItemId));
    if (!row || row.payout.status === item.transactionStatus) continue;
    const updated = await db
      .update(payouts)
      .set({ status: item.transactionStatus })
      .where(and(eq(payouts.id, row.payout.id), eq(payouts.status, row.payout.status)))
      .returning();
    if (updated.length === 0) continue;
    await logActivity({
      actor: 'paypal',
      action: 'payout_status',
      summary: `Payout to ${row.collaborator.name}: ${item.transactionStatus}`,
      reason: `${formatUsd(row.payout.amountCents)} via PayPal Payouts`,
      invoiceId: row.payout.invoiceId,
    });
  }
}
