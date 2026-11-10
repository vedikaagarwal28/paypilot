import { eq } from 'drizzle-orm';
import { PAID_STATUSES } from '@/lib/actions/can-execute';
import { getDb } from '@/lib/db/client';
import { invoices } from '@/lib/db/schema';
import { handleInvoicePaid } from '@/lib/payments/on-paid';
import { getInvoice, payerViewUrl } from '@/lib/paypal/invoicing';
import { getSettings } from '@/lib/settings/store';

const FINAL = ['CANCELLED'];

/** Refreshes the DB cache from PayPal (the source of truth) and pays out anything that became paid. */
export async function syncInvoices(): Promise<{ updated: number; newlyPaid: string[] }> {
  const { demoBatch } = await getSettings();
  if (!demoBatch) return { updated: 0, newlyPaid: [] };
  const db = getDb();
  const local = await db.select().from(invoices).where(eq(invoices.demoBatch, demoBatch));
  // Fetch by id: invoice search matches whole invoice numbers, not batch prefixes.
  const pending = local.filter((i) => !FINAL.includes(i.status) && !(PAID_STATUSES.includes(i.status) && i.paidAt));
  const remote = await Promise.all(pending.map((i) => getInvoice(i.paypalId).then((r) => ({ row: i, r }))));

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
