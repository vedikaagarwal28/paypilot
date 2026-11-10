/**
 * Sandbox smoke test (plan Task 0, step 8). Uses raw fetch on purpose so it works before lib/ exists.
 *   npm run smoke            → create + send a back-dated $10 invoice to buyer 1, print payer link
 *   npm run smoke -- payout  → send a $1 payout to collaborator 1 and print its batch status
 */
import 'dotenv/config';

const BASE = process.env.PAYPAL_API_BASE ?? 'https://api-m.sandbox.paypal.com';

async function token(): Promise<string> {
  const auth = Buffer.from(`${process.env.PAYPAL_CLIENT_ID}:${process.env.PAYPAL_CLIENT_SECRET}`).toString('base64');
  const r = await fetch(`${BASE}/v1/oauth2/token`, {
    method: 'POST',
    headers: { Authorization: `Basic ${auth}`, 'Content-Type': 'application/x-www-form-urlencoded' },
    body: 'grant_type=client_credentials',
  });
  const j = await r.json();
  if (!r.ok) throw new Error(`token: ${r.status} ${JSON.stringify(j)}`);
  return j.access_token;
}

async function call(t: string, method: string, path: string, body?: unknown) {
  const r = await fetch(`${BASE}${path}`, {
    method,
    headers: { Authorization: `Bearer ${t}`, 'Content-Type': 'application/json', Prefer: 'return=representation' },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await r.text();
  const json = text ? JSON.parse(text) : null;
  console.log(`${method} ${path} → ${r.status}`);
  if (!r.ok) console.log(JSON.stringify(json, null, 2));
  return { ok: r.ok, status: r.status, json };
}

const iso = (d: Date) => d.toISOString().slice(0, 10);
const daysAgo = (n: number) => iso(new Date(Date.now() - n * 86400000));

async function invoice(t: string) {
  const buyer = (process.env.SANDBOX_BUYER_EMAILS ?? '').split(',')[0]?.trim();
  if (!buyer) throw new Error('SANDBOX_BUYER_EMAILS is empty');
  const created = await call(t, 'POST', '/v2/invoicing/invoices', {
    detail: {
      currency_code: 'USD',
      invoice_number: `SMOKE-${Date.now()}`,
      invoice_date: daysAgo(20),
      payment_term: { due_date: daysAgo(10) },
      note: 'PayPilot smoke test',
    },
    primary_recipients: [{ billing_info: { email_address: buyer, name: { given_name: 'Smoke', surname: 'Test' } } }],
    items: [{ name: 'Smoke test', quantity: '1', unit_amount: { currency_code: 'USD', value: '10.00' } }],
  });
  if (!created.ok) {
    console.log('\n✗ Back-dated invoice rejected → set DEMO_CLOCK_OFFSET_DAYS=30 and re-run with that in mind.');
    return;
  }
  const id = created.json.id ?? String(created.json.href).split('/').pop();
  console.log(`✓ Back-dated invoice accepted: ${id}`);
  await call(t, 'POST', `/v2/invoicing/invoices/${id}/send`, { send_to_recipient: true });
  const inv = await call(t, 'GET', `/v2/invoicing/invoices/${id}`);
  const payer = inv.json?.detail?.metadata?.recipient_view_url
    ?? inv.json?.links?.find((l: { rel: string }) => l.rel === 'payer-view')?.href;
  console.log(`\nStatus: ${inv.json?.status}`);
  console.log(`Payer link: ${payer ?? '(none found — inspect the GET output)'}`);
  console.log(`\nNext: open the link in a private window, log in as ${buyer}, pay, then watch Render logs for INVOICING.INVOICE.PAID.`);
  console.log('If paying fails, set DEMO_PAY_MODE=record.');
}

async function payout(t: string) {
  const collab = (process.env.SANDBOX_COLLAB_EMAILS ?? '').split(',')[0]?.trim();
  if (!collab) throw new Error('SANDBOX_COLLAB_EMAILS is empty');
  const res = await call(t, 'POST', '/v1/payments/payouts', {
    sender_batch_header: { sender_batch_id: `smoke-${Date.now()}`, email_subject: 'PayPilot smoke payout' },
    items: [{ recipient_type: 'EMAIL', amount: { value: '1.00', currency: 'USD' }, receiver: collab, note: 'smoke', sender_item_id: `smoke-${Date.now()}` }],
  });
  if (!res.ok) {
    console.log('\n✗ Payout failed. AUTHORIZATION_ERROR → tick Payouts in the app features. INSUFFICIENT_FUNDS → fund the business account.');
    return;
  }
  const batchId = res.json.batch_header.payout_batch_id;
  await new Promise((r) => setTimeout(r, 5000));
  const b = await call(t, 'GET', `/v1/payments/payouts/${batchId}`);
  console.log(`✓ Payout batch ${batchId}: ${b.json?.batch_header?.batch_status}`);
}

(async () => {
  const t = await token();
  console.log('✓ OAuth token OK');
  if (process.argv[2] === 'payout') await payout(t);
  else await invoice(t);
})().catch((e) => { console.error(e); process.exit(1); });
