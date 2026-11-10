import { logActivity } from '@/lib/activity/log';
import { describePayPalError } from '@/lib/paypal/http';
import { extractInvoiceId, extractPayoutBatchId, verifyWebhook } from '@/lib/paypal/webhooks';
import { handleInvoicePaid, refreshPayoutBatch } from '@/lib/payments/on-paid';
import { syncInvoices } from '@/lib/sync/invoices';

export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  const raw = await req.text();
  if (!(await verifyWebhook(req.headers, raw))) {
    return Response.json({ error: 'Invalid webhook signature' }, { status: 401 });
  }
  const event = JSON.parse(raw);
  const type: string = event.event_type ?? '';
  try {
    if (type === 'INVOICING.INVOICE.PAID') {
      const id = extractInvoiceId(event);
      if (id) await handleInvoicePaid(id, 'webhook');
    } else if (type === 'INVOICING.INVOICE.CANCELLED') {
      await syncInvoices();
    } else if (type.startsWith('PAYMENT.PAYOUTS')) {
      const batchId = extractPayoutBatchId(event);
      if (batchId) await refreshPayoutBatch(batchId);
    }
    return Response.json({ ok: true });
  } catch (e) {
    await logActivity({ actor: 'system', action: 'webhook_error', summary: `Webhook ${type} failed`, reason: describePayPalError(e) }).catch(() => {});
    return Response.json({ error: describePayPalError(e) }, { status: 500 });
  }
}
