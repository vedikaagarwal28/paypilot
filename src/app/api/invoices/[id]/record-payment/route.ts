import { eq } from 'drizzle-orm';
import { logActivity } from '@/lib/activity/log';
import { PAID_STATUSES } from '@/lib/actions/can-execute';
import { demoNow, isoDate } from '@/lib/clock';
import { getDb } from '@/lib/db/client';
import { invoices } from '@/lib/db/schema';
import { describePayPalError } from '@/lib/paypal/http';
import { recordPayment } from '@/lib/paypal/invoicing';
import { syncInvoices } from '@/lib/sync/invoices';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

/**
 * Fallback for DEMO_PAY_MODE=record: records an off-PayPal payment on the real sandbox invoice.
 * PayPal still fires INVOICING.INVOICE.PAID; the sync below covers a late webhook.
 */
export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const id = Number((await params).id);
  if (!Number.isInteger(id)) return Response.json({ error: 'Bad request' }, { status: 400 });
  const [inv] = await getDb().select().from(invoices).where(eq(invoices.id, id));
  if (!inv) return Response.json({ error: 'Invoice not found' }, { status: 404 });
  if (PAID_STATUSES.includes(inv.status)) return Response.json({ error: 'Invoice already paid' }, { status: 409 });
  try {
    await recordPayment(inv.paypalId, inv.amountCents, isoDate(demoNow()));
    await logActivity({ actor: 'user', action: 'payment_recorded', summary: `Recorded client payment on ${inv.number}`, reason: 'Client paid outside the PayPal checkout (recorded in PayPal)', invoiceId: id });
    await syncInvoices();
    return Response.json({ ok: true });
  } catch (e) {
    return Response.json({ error: describePayPalError(e) }, { status: 500 });
  }
}
