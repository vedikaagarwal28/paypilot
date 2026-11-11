import { env } from '@/lib/env';

export class PayPalError extends Error {
  status: number;
  debugId?: string;
  details?: unknown;

  constructor(e: { status: number; name: string; message: string; debugId?: string; details?: unknown }) {
    super(e.message);
    this.name = e.name;
    this.status = e.status;
    this.debugId = e.debugId;
    this.details = e.details;
  }
}

export function describePayPalError(e: unknown): string {
  if (e instanceof PayPalError) return `PayPal: ${e.name}: ${e.message}`;
  if (e instanceof Error) return e.message;
  return String(e);
}

const TIMEOUT_MS = 15_000;

let token: { value: string; expiresAt: number } | null = null;

export async function getAccessToken(): Promise<string> {
  if (token && Date.now() < token.expiresAt) return token.value;
  const { PAYPAL_API_BASE, PAYPAL_CLIENT_ID, PAYPAL_CLIENT_SECRET } = env();
  const res = await fetch(`${PAYPAL_API_BASE}/v1/oauth2/token`, {
    method: 'POST',
    headers: {
      Authorization: `Basic ${Buffer.from(`${PAYPAL_CLIENT_ID}:${PAYPAL_CLIENT_SECRET}`).toString('base64')}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: 'grant_type=client_credentials',
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });
  const json = await res.json();
  if (!res.ok) {
    throw new PayPalError({ status: res.status, name: json.error ?? 'AUTH_FAILED', message: json.error_description ?? 'Could not get PayPal access token' });
  }
  token = { value: json.access_token, expiresAt: Date.now() + (json.expires_in - 60) * 1000 };
  return token.value;
}

/** `raw` sends a pre-serialised JSON body untouched (used for webhook verification). */
export async function paypalFetch<T>(path: string, init: { method?: string; body?: unknown; raw?: string } = {}): Promise<T> {
  const res = await fetch(`${env().PAYPAL_API_BASE}${path}`, {
    signal: AbortSignal.timeout(TIMEOUT_MS),
    method: init.method ?? 'GET',
    headers: {
      Authorization: `Bearer ${await getAccessToken()}`,
      'Content-Type': 'application/json',
      Prefer: 'return=representation',
    },
    body: init.raw ?? (init.body === undefined ? undefined : JSON.stringify(init.body)),
  });
  if (res.status === 204) return undefined as T;
  const text = await res.text();
  const json = text ? JSON.parse(text) : undefined;
  if (!res.ok) {
    throw new PayPalError({
      status: res.status,
      name: json?.name ?? `HTTP_${res.status}`,
      message: json?.message ?? json?.details?.[0]?.description ?? res.statusText,
      debugId: json?.debug_id,
      details: json?.details,
    });
  }
  return json as T;
}
