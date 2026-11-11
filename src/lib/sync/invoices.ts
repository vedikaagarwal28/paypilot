import { and, eq, lt } from 'drizzle-orm';
import { PAID_STATUSES } from '@/lib/actions/can-execute';
import { getDb } from '@/lib/db/client';
import { invoices, pendingActions } from '@/lib/db/schema';
import { handleInvoicePaid, refreshPendingPayouts } from '@/lib/payments/on-paid';
import { getInvoice, payerViewUrl } from '@/lib/paypal/invoicing';
import { getSettings } from '@/lib/settings/store';
import { shouldSync } from './throttle';

const FINAL = ['CANCELLED'];

/** Refreshes the DB cache from PayPal (the source of truth) and pays out anything that became paid. */
export async function syncInvoices(): Promise<{ updated: number; newlyPaid: string[] }> {
  const { demoBatch } = await getSettings();
  if (!demoBatch) return { updated: 0, newlyPaid: [] };
  const db = getDb();
  const local = await db.select().from(invoices).where(eq(invoices.demoBatch, demoBatch));
  // Fetch by id: invoice search matches whole invoice numbers, not batch prefixes.
  const pending = local.filter((i) => !FINAL.includes(i.status) && !(PAID_STATUSES.includes(i.status) && i.paidAt));
  const settled = await Promise.allSettled(pending.map((i) => getInvoice(i.paypalId).then((r) => ({ row: i, r }))));
  const remote = settled.flatMap((s) => (s.status === 'fulfilled' ? [s.value] : []));

  let updated = 0;
  const newlyPaid: string[] = [];
  for (const { row, r } of remote) {
    const link = payerViewUrl(r);
    if (row.status !== r.status || (link && link !== row.payerViewUrl)) {
      await db.update(invoices).set({ status: r.status, payerViewUrl: link ?? row.payerViewUrl, updatedAt: new Date() }).where(eq(invoices.id, row.id));
      updated++;
    }
    if (PAID_STATUSES.includes(r.status) && !row.paidAt) newlyPaid.push(r.id);
  }
  for (const id of newlyPaid) await handleInvoicePaid(id, 'sync');
  return { updated, newlyPaid };
}

/** Actions stuck in "executing" (crash or hung request) become failed so Retry is offered. */
export async function recoverStaleActions(): Promise<void> {
  await getDb()
    .update(pendingActions)
    .set({ status: 'failed', error: 'Timed out while sending. Check PayPal before retrying.' })
    .where(and(eq(pendingActions.status, 'executing'), lt(pendingActions.decidedAt, new Date(Date.now() - 2 * 60 * 1000))));
}

let lastSyncAt: number | null = null;
let inFlight: Promise<void> | null = null;

/**
 * Polling backup for webhooks (Render free tier sleeps; webhook IDs get mistyped).
 * Called from the routes the UI polls; runs at most every 10s per server instance and never throws.
 */
export async function maybeSync(): Promise<void> {
  if (inFlight) return inFlight;
  if (!shouldSync(lastSyncAt, Date.now(), 10_000)) return;
  lastSyncAt = Date.now();
  inFlight = (async () => {
    await Promise.allSettled([syncInvoices(), refreshPendingPayouts(), recoverStaleActions()]);
  })().finally(() => { inFlight = null; });
  return inFlight;
}
