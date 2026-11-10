import { vi } from 'vitest';

export type Call = { url: string; init: RequestInit & { body?: string } };

/** Stubs global fetch with queued responses; records every call. */
export function stubFetch(responses: Array<{ status?: number; json?: unknown }>) {
  const calls: Call[] = [];
  const queue = [...responses];
  vi.stubGlobal('fetch', vi.fn(async (url: string, init: RequestInit = {}) => {
    calls.push({ url: String(url), init: init as Call['init'] });
    const r = queue.shift() ?? { status: 200, json: {} };
    const status = r.status ?? 200;
    return new Response(status === 204 ? null : JSON.stringify(r.json ?? {}), {
      status,
      headers: { 'content-type': 'application/json' },
    });
  }));
  return calls;
}

export function setTestEnv() {
  Object.assign(process.env, {
    PAYPAL_CLIENT_ID: 'cid',
    PAYPAL_CLIENT_SECRET: 'secret',
    PAYPAL_WEBHOOK_ID: 'WID',
    PAYPAL_API_BASE: 'https://api-m.sandbox.paypal.com',
    DATABASE_URL: 'postgres://test',
  });
}
