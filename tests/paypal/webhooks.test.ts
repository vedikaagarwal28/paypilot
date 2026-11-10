import { beforeEach, expect, test, vi } from 'vitest';
import { setTestEnv } from '../helpers';
import { buildVerifyBody, extractInvoiceId, extractPayoutBatchId } from '@/lib/paypal/webhooks';

beforeEach(() => { setTestEnv(); vi.unstubAllGlobals(); });

const headersWithAllFive = () => new Headers({
  'paypal-auth-algo': 'SHA256withRSA',
  'paypal-cert-url': 'https://api.sandbox.paypal.com/cert',
  'paypal-transmission-id': 'tid',
  'paypal-transmission-sig': 'sig',
  'paypal-transmission-time': '2026-11-11T00:00:00Z',
});

test('buildVerifyBody embeds raw event verbatim', () => {
  const raw = '{"id": "WH-1",  "event_type":"INVOICING.INVOICE.PAID"}';
  const out = buildVerifyBody(headersWithAllFive(), raw, 'WID');
  expect(out).toContain('"webhook_event":' + raw);
  const parsed = JSON.parse(out);
  expect(parsed.webhook_id).toBe('WID');
  expect(parsed.transmission_sig).toBe('sig');
});

test('buildVerifyBody throws when paypal-transmission-sig missing', () => {
  const h = headersWithAllFive();
  h.delete('paypal-transmission-sig');
  expect(() => buildVerifyBody(h, '{}', 'WID')).toThrow(/paypal-transmission-sig/);
});

test('extractInvoiceId handles both shapes', () => {
  expect(extractInvoiceId({ resource: { invoice: { id: 'INV2-A' } } })).toBe('INV2-A');
  expect(extractInvoiceId({ resource: { id: 'INV2-B' } })).toBe('INV2-B');
  expect(extractInvoiceId({})).toBeNull();
});

test('extractPayoutBatchId handles batch and item events', () => {
  expect(extractPayoutBatchId({ resource: { batch_header: { payout_batch_id: 'B1' } } })).toBe('B1');
  expect(extractPayoutBatchId({ resource: { payout_batch_id: 'B2' } })).toBe('B2');
  expect(extractPayoutBatchId({})).toBeNull();
});

test('verifyWebhook short-circuits when skip flag set', async () => {
  process.env.PAYPAL_WEBHOOK_SKIP_VERIFY = 'true';
  vi.resetModules();
  const { verifyWebhook } = await import('@/lib/paypal/webhooks');
  expect(await verifyWebhook(new Headers(), '{}')).toBe(true);
  process.env.PAYPAL_WEBHOOK_SKIP_VERIFY = 'false';
});
