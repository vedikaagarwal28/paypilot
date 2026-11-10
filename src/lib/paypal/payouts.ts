import { centsToString } from '@/lib/money';
import { paypalFetch } from './http';

export async function createPayoutBatch(i: {
  senderBatchId: string;
  emailSubject: string;
  items: { senderItemId: string; receiverEmail: string; amountCents: number; note: string }[];
}): Promise<{ payoutBatchId: string; status: string }> {
  const res = await paypalFetch<{ batch_header: { payout_batch_id: string; batch_status: string } }>('/v1/payments/payouts', {
    method: 'POST',
    body: {
      sender_batch_header: { sender_batch_id: i.senderBatchId, email_subject: i.emailSubject },
      items: i.items.map((it) => ({
        recipient_type: 'EMAIL',
        amount: { value: centsToString(it.amountCents), currency: 'USD' },
        receiver: it.receiverEmail,
        note: it.note,
        sender_item_id: it.senderItemId,
      })),
    },
  });
  return { payoutBatchId: res.batch_header.payout_batch_id, status: res.batch_header.batch_status };
}

export async function getPayoutBatch(payoutBatchId: string): Promise<{
  status: string;
  items: { senderItemId: string; payoutItemId: string; transactionStatus: string }[];
}> {
  const res = await paypalFetch<{
    batch_header: { batch_status: string };
    items?: { payout_item_id: string; transaction_status: string; payout_item: { sender_item_id: string } }[];
  }>(`/v1/payments/payouts/${payoutBatchId}`);
  return {
    status: res.batch_header.batch_status,
    items: (res.items ?? []).map((it) => ({
      senderItemId: it.payout_item.sender_item_id,
      payoutItemId: it.payout_item_id,
      transactionStatus: it.transaction_status,
    })),
  };
}
