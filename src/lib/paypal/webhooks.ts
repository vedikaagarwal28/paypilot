import { env } from '@/lib/env';
import { paypalFetch } from './http';

const HEADERS = {
  auth_algo: 'paypal-auth-algo',
  cert_url: 'paypal-cert-url',
  transmission_id: 'paypal-transmission-id',
  transmission_sig: 'paypal-transmission-sig',
  transmission_time: 'paypal-transmission-time',
} as const;

/**
 * Builds the verify-webhook-signature body by string concatenation so the event
 * is passed exactly as PayPal sent it; re-serialised JSON can fail verification.
 */
export function buildVerifyBody(headers: Headers, rawBody: string, webhookId: string): string {
  const fields = Object.entries(HEADERS).map(([key, header]) => {
    const value = headers.get(header);
    if (!value) throw new Error(`Missing webhook header ${header}`);
    return `${JSON.stringify(key)}:${JSON.stringify(value)}`;
  });
  return `{${fields.join(',')},"webhook_id":${JSON.stringify(webhookId)},"webhook_event":${rawBody}}`;
}

export async function verifyWebhook(headers: Headers, rawBody: string): Promise<boolean> {
  const e = env();
  if (e.PAYPAL_WEBHOOK_SKIP_VERIFY === 'true') return true;
  let body: string;
  try {
    body = buildVerifyBody(headers, rawBody, e.PAYPAL_WEBHOOK_ID);
  } catch {
    return false;
  }
  const res = await paypalFetch<{ verification_status: string }>('/v1/notifications/verify-webhook-signature', {
    method: 'POST',
    raw: body,
  });
  return res.verification_status === 'SUCCESS';
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type WebhookEvent = any;

export function extractInvoiceId(event: WebhookEvent): string | null {
  return event?.resource?.invoice?.id ?? event?.resource?.id ?? null;
}

export function extractPayoutBatchId(event: WebhookEvent): string | null {
  return event?.resource?.batch_header?.payout_batch_id ?? event?.resource?.payout_batch_id ?? null;
}
