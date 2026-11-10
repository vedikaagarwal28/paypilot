import { beforeEach, expect, test, vi } from 'vitest';
import { setTestEnv, stubFetch } from '../helpers';

const TOKEN = { json: { access_token: 'T1', expires_in: 32400 } };

beforeEach(() => { setTestEnv(); vi.resetModules(); vi.unstubAllGlobals(); });

test('createDraftInvoice sends USD "1800.00" and due_date', async () => {
  const calls = stubFetch([TOKEN, { status: 201, json: { id: 'INV2-AAA' } }]);
  const { createDraftInvoice } = await import('@/lib/paypal/invoicing');
  const res = await createDraftInvoice({
    number: 'PP1-3', recipientEmail: 'buyer@x.com', recipientName: 'Acme Corp',
    description: 'Website redesign', amountCents: 180000, invoiceDate: '2026-10-08', dueDate: '2026-10-22',
  });
  expect(res).toEqual({ id: 'INV2-AAA' });
  const body = JSON.parse(calls[1].init.body!);
  expect(calls[1].url).toBe('https://api-m.sandbox.paypal.com/v2/invoicing/invoices');
  expect(body.detail.currency_code).toBe('USD');
  expect(body.detail.invoice_number).toBe('PP1-3');
  expect(body.detail.payment_term.due_date).toBe('2026-10-22');
  expect(body.items[0].unit_amount.value).toBe('1800.00');
  expect(body.primary_recipients[0].billing_info.email_address).toBe('buyer@x.com');
});

test('createDraftInvoice parses id from href when body lacks id', async () => {
  stubFetch([TOKEN, { status: 201, json: { rel: 'self', href: 'https://api-m.sandbox.paypal.com/v2/invoicing/invoices/INV2-BBB', method: 'GET' } }]);
  const { createDraftInvoice } = await import('@/lib/paypal/invoicing');
  const res = await createDraftInvoice({
    number: 'PP1-4', recipientEmail: 'b@x.com', recipientName: 'B', description: 'd', amountCents: 100, invoiceDate: '2026-11-01', dueDate: '2026-11-02',
  });
  expect(res).toEqual({ id: 'INV2-BBB' });
});

test('updateInvoiceNote GETs then PUTs with only note changed', async () => {
  const existing = { id: 'INV2-AAA', status: 'SENT', detail: { invoice_number: 'PP1-3', note: 'old', currency_code: 'USD' }, items: [] };
  const calls = stubFetch([TOKEN, { json: existing }, { json: existing }]);
  const { updateInvoiceNote } = await import('@/lib/paypal/invoicing');
  await updateInvoiceNote('INV2-AAA', 'new');
  expect(calls[2].init.method).toBe('PUT');
  const body = JSON.parse(calls[2].init.body!);
  expect(body.detail.note).toBe('new');
  expect(body.detail.invoice_number).toBe('PP1-3');
});

test('remindInvoice resolves on 204', async () => {
  const calls = stubFetch([TOKEN, { status: 204 }]);
  const { remindInvoice } = await import('@/lib/paypal/invoicing');
  await expect(remindInvoice('INV2-AAA')).resolves.toBeUndefined();
  expect(calls[1].url).toBe('https://api-m.sandbox.paypal.com/v2/invoicing/invoices/INV2-AAA/remind');
  expect(JSON.parse(calls[1].init.body!)).toEqual({ send_to_recipient: true });
});

test('payerViewUrl picks payer-view link', async () => {
  const { payerViewUrl } = await import('@/lib/paypal/invoicing');
  expect(payerViewUrl({ id: 'x', status: 'SENT', detail: {}, links: [{ rel: 'self', href: 'a' }, { rel: 'payer-view', href: 'https://pay' }] } as never)).toBe('https://pay');
  expect(payerViewUrl({ id: 'x', status: 'DRAFT', detail: {} } as never)).toBeNull();
});
