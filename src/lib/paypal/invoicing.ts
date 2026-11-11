import { centsToString, toCents } from '@/lib/money';
import { paypalFetch } from './http';

export interface PayPalInvoice {
  id: string;
  status: string;
  detail: {
    invoice_number?: string;
    invoice_date?: string;
    payment_term?: { due_date?: string };
    note?: string;
    currency_code?: string;
    metadata?: { recipient_view_url?: string };
  };
  amount?: { value: string; currency_code: string };
  primary_recipients?: { billing_info?: { email_address?: string } }[];
  links?: { rel: string; href: string }[];
  [key: string]: unknown;
}

const BASE = '/v2/invoicing/invoices';

export async function createDraftInvoice(i: {
  number: string;
  recipientEmail: string;
  recipientName: string;
  description: string;
  amountCents: number;
  invoiceDate: string;
  dueDate: string;
  note?: string;
}): Promise<{ id: string }> {
  const res = await paypalFetch<{ id?: string; href?: string }>(BASE, {
    method: 'POST',
    body: {
      detail: {
        currency_code: 'USD',
        invoice_number: i.number,
        invoice_date: i.invoiceDate,
        payment_term: { due_date: i.dueDate },
        ...(i.note ? { note: i.note } : {}),
      },
      primary_recipients: [{ billing_info: { email_address: i.recipientEmail, business_name: i.recipientName } }],
      items: [{ name: i.description, quantity: '1', unit_amount: { currency_code: 'USD', value: centsToString(i.amountCents) } }],
    },
  });
  // With return=minimal PayPal answers with a self link instead of the invoice.
  const id = res.id ?? res.href?.split('/').pop();
  if (!id) throw new Error('PayPal did not return an invoice id');
  return { id };
}

export async function sendInvoice(id: string): Promise<void> {
  await paypalFetch(`${BASE}/${id}/send`, { method: 'POST', body: { send_to_recipient: true } });
}

export async function remindInvoice(id: string): Promise<void> {
  await paypalFetch(`${BASE}/${id}/remind`, { method: 'POST', body: { send_to_recipient: true } });
}

export function getInvoice(id: string): Promise<PayPalInvoice> {
  return paypalFetch<PayPalInvoice>(`${BASE}/${id}`);
}

export async function searchInvoices(numberPrefix: string): Promise<PayPalInvoice[]> {
  const all: PayPalInvoice[] = [];
  for (let page = 1; ; page++) {
    const res = await paypalFetch<{ items?: PayPalInvoice[]; total_pages?: number }>(
      `/v2/invoicing/search-invoices?page=${page}&page_size=100&total_required=true`,
      { method: 'POST', body: { invoice_number: numberPrefix } },
    );
    all.push(...(res.items ?? []));
    if (!res.total_pages || page >= res.total_pages) return all;
  }
}

export async function updateInvoiceNote(id: string, note: string): Promise<void> {
  const inv = await getInvoice(id);
  await paypalFetch(`${BASE}/${id}?send_to_recipient=false`, {
    method: 'PUT',
    body: { ...inv, detail: { ...inv.detail, note } },
  });
}

export async function cancelInvoice(id: string): Promise<void> {
  await paypalFetch(`${BASE}/${id}/cancel`, { method: 'POST', body: { send_to_recipient: false } });
}

export async function deleteDraftInvoice(id: string): Promise<void> {
  await paypalFetch(`${BASE}/${id}`, { method: 'DELETE' });
}

export async function recordPayment(id: string, amountCents: number, date: string): Promise<void> {
  await paypalFetch(`${BASE}/${id}/payments`, {
    method: 'POST',
    body: { method: 'BANK_TRANSFER', payment_date: date, amount: { currency_code: 'USD', value: centsToString(amountCents) } },
  });
}

/** Amount actually received on a fully paid invoice; null unless PayPal reports it as paid. */
export function paidAmountCents(inv: PayPalInvoice): number | null {
  if (inv.status !== 'PAID' && inv.status !== 'MARKED_AS_PAID') return null;
  const paid = (inv.payments as { paid_amount?: { value: string } } | undefined)?.paid_amount?.value ?? inv.amount?.value;
  return paid ? toCents(paid) : null;
}

export function payerViewUrl(inv: PayPalInvoice): string | null {
  return inv.links?.find((l) => l.rel === 'payer-view')?.href ?? inv.detail?.metadata?.recipient_view_url ?? null;
}
