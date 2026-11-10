import { beforeEach, expect, test, vi } from 'vitest';
import { setTestEnv, stubFetch } from '../helpers';

beforeEach(() => { setTestEnv(); vi.resetModules(); vi.unstubAllGlobals(); });

test('getAccessToken posts client_credentials with basic auth and caches', async () => {
  const calls = stubFetch([{ json: { access_token: 'T1', expires_in: 32400 } }]);
  const { getAccessToken } = await import('@/lib/paypal/http');
  expect(await getAccessToken()).toBe('T1');
  expect(await getAccessToken()).toBe('T1');
  expect(calls).toHaveLength(1);
  expect(calls[0].url).toBe('https://api-m.sandbox.paypal.com/v1/oauth2/token');
  expect(calls[0].init.body).toBe('grant_type=client_credentials');
  expect((calls[0].init.headers as Record<string, string>).Authorization).toMatch(/^Basic /);
});

test('paypalFetch throws PayPalError with debugId on 422', async () => {
  stubFetch([
    { json: { access_token: 'T1', expires_in: 32400 } },
    { status: 422, json: { name: 'UNPROCESSABLE_ENTITY', message: 'x', debug_id: 'abc' } },
  ]);
  const { paypalFetch } = await import('@/lib/paypal/http');
  await expect(paypalFetch('/v2/invoicing/invoices', { method: 'POST', body: {} }))
    .rejects.toMatchObject({ status: 422, name: 'UNPROCESSABLE_ENTITY', debugId: 'abc' });
});

test('describePayPalError renders one line', async () => {
  const { PayPalError, describePayPalError } = await import('@/lib/paypal/http');
  expect(describePayPalError(new PayPalError({ status: 422, name: 'INSUFFICIENT_FUNDS', message: 'Sender does not have sufficient funds.' })))
    .toBe('PayPal: INSUFFICIENT_FUNDS: Sender does not have sufficient funds.');
  expect(describePayPalError(new Error('boom'))).toBe('boom');
});
