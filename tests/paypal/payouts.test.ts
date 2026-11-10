import { beforeEach, expect, test, vi } from 'vitest';
import { setTestEnv, stubFetch } from '../helpers';

const TOKEN = { json: { access_token: 'T1', expires_in: 32400 } };
beforeEach(() => { setTestEnv(); vi.resetModules(); vi.unstubAllGlobals(); });

test('createPayoutBatch formats items', async () => {
  const calls = stubFetch([TOKEN, { status: 201, json: { batch_header: { payout_batch_id: 'B1', batch_status: 'PENDING' } } }]);
  const { createPayoutBatch } = await import('@/lib/paypal/payouts');
  const res = await createPayoutBatch({
    senderBatchId: 'paid-INV2-X', emailSubject: 'You have a payout from PayPilot',
    items: [{ senderItemId: 'INV2-X-1', receiverEmail: 'maya@x', amountCents: 54000, note: 'Split' }],
  });
  expect(res).toEqual({ payoutBatchId: 'B1', status: 'PENDING' });
  const body = JSON.parse(calls[1].init.body!);
  expect(calls[1].url).toBe('https://api-m.sandbox.paypal.com/v1/payments/payouts');
  expect(body.sender_batch_header.sender_batch_id).toBe('paid-INV2-X');
  expect(body.items[0]).toEqual({
    recipient_type: 'EMAIL', amount: { value: '540.00', currency: 'USD' }, receiver: 'maya@x', note: 'Split', sender_item_id: 'INV2-X-1',
  });
});

test('getPayoutBatch maps items', async () => {
  stubFetch([TOKEN, { json: { batch_header: { batch_status: 'SUCCESS' }, items: [{ payout_item_id: 'P1', transaction_status: 'SUCCESS', payout_item: { sender_item_id: 'INV2-X-1' } }] } }]);
  const { getPayoutBatch } = await import('@/lib/paypal/payouts');
  expect(await getPayoutBatch('B1')).toEqual({ status: 'SUCCESS', items: [{ senderItemId: 'INV2-X-1', payoutItemId: 'P1', transactionStatus: 'SUCCESS' }] });
});
