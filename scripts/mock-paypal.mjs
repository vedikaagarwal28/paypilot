// Simulated PayPal REST API for recording the demo without a PayPal sandbox account.
// Answers only the calls PayPilot makes (OAuth, Invoicing v2, Payouts v1, webhook verification), keeps state in
// memory, and completes payout batches a few seconds after they're created, like the sandbox does.
//
//   node scripts/mock-paypal.mjs [port]      then run the app with PAYPAL_API_BASE=http://localhost:<port>
//
// Nothing here talks to PayPal. The app shows "PayPal simulated" in its header while pointed at this server.

import { randomBytes } from 'node:crypto';
import { createServer } from 'node:http';

const PORT = Number(process.argv[2] ?? process.env.MOCK_PAYPAL_PORT ?? 4010);
const BASE = `http://localhost:${PORT}`;
const PAYOUT_SECONDS = 4;

const invoices = new Map();
const batches = new Map();

const id = (prefix, n = 4) => `${prefix}${Array.from({ length: n }, () => randomBytes(2).toString('hex').toUpperCase()).join('-')}`;
const money = (value) => ({ currency_code: 'USD', value });

function total(items = []) {
  return items.reduce((s, it) => s + Number(it.unit_amount?.value ?? 0) * Number(it.quantity ?? 1), 0).toFixed(2);
}

function view(inv) {
  return {
    ...inv,
    amount: money(total(inv.items)),
    links: [
      { rel: 'self', href: `${BASE}/v2/invoicing/invoices/${inv.id}`, method: 'GET' },
      { rel: 'payer-view', href: `${BASE}/invoice/p/${inv.id}`, method: 'GET' },
    ],
  };
}

function payoutView(batch) {
  const done = Date.now() - batch.created > PAYOUT_SECONDS * 1000;
  return {
    batch_header: {
      payout_batch_id: batch.id,
      batch_status: done ? 'SUCCESS' : 'PENDING',
      sender_batch_header: batch.header,
    },
    items: batch.items.map((it) => ({
      payout_item_id: it.payoutItemId,
      transaction_status: done ? 'SUCCESS' : 'PENDING',
      payout_item: { ...it.item, sender_item_id: it.item.sender_item_id },
    })),
  };
}

const notFound = () => [404, { name: 'RESOURCE_NOT_FOUND', message: 'The specified resource does not exist.' }];

function route(method, path, query, body) {
  if (method === 'POST' && path === '/v1/oauth2/token') {
    return [200, { access_token: `SIMULATED-${randomBytes(8).toString('hex')}`, token_type: 'Bearer', expires_in: 32400 }];
  }

  if (method === 'POST' && path === '/v2/invoicing/invoices') {
    const inv = { id: id('INV2-'), status: 'DRAFT', detail: { ...body.detail, metadata: { create_time: new Date().toISOString() } }, primary_recipients: body.primary_recipients, items: body.items };
    invoices.set(inv.id, inv);
    return [201, view(inv)];
  }

  if (method === 'POST' && path === '/v2/invoicing/search-invoices') {
    const items = [...invoices.values()].filter((i) => !body?.invoice_number || i.detail.invoice_number === body.invoice_number).map(view);
    return [200, { items, total_items: items.length, total_pages: 1 }];
  }

  let m = path.match(/^\/v2\/invoicing\/invoices\/([^/]+)(?:\/(send|remind|cancel|payments))?$/);
  if (m) {
    const inv = invoices.get(m[1]);
    if (!inv) return notFound();
    const action = m[2];
    if (!action && method === 'GET') return [200, view(inv)];
    if (!action && method === 'PUT') {
      Object.assign(inv, { detail: body.detail ?? inv.detail, primary_recipients: body.primary_recipients ?? inv.primary_recipients, items: body.items ?? inv.items });
      return [200, view(inv)];
    }
    if (!action && method === 'DELETE') {
      invoices.delete(inv.id);
      return [204];
    }
    if (action === 'send') {
      inv.status = 'SENT';
      return [200, { links: view(inv).links }];
    }
    if (action === 'remind') return [204];
    if (action === 'cancel') {
      inv.status = 'CANCELLED';
      return [204];
    }
    if (action === 'payments') {
      inv.status = 'MARKED_AS_PAID';
      inv.payments = { paid_amount: money(body.amount.value), transactions: [{ payment_id: id('EXTR-', 2), method: body.method, payment_date: body.payment_date, amount: body.amount }] };
      return [200, { payment_id: inv.payments.transactions[0].payment_id }];
    }
  }

  if (method === 'POST' && path === '/v1/payments/payouts') {
    const batch = {
      id: id('', 2).replaceAll('-', ''),
      created: Date.now(),
      header: body.sender_batch_header,
      items: body.items.map((item) => ({ payoutItemId: id('', 2).replaceAll('-', ''), item })),
    };
    batches.set(batch.id, batch);
    return [201, { batch_header: { payout_batch_id: batch.id, batch_status: 'PENDING', sender_batch_header: batch.header } }];
  }

  m = path.match(/^\/v1\/payments\/payouts\/([^/]+)$/);
  if (m && method === 'GET') {
    const batch = batches.get(m[1]);
    return batch ? [200, payoutView(batch)] : notFound();
  }

  if (method === 'POST' && path === '/v1/notifications/verify-webhook-signature') {
    return [200, { verification_status: 'SUCCESS' }];
  }

  // The "Pay as client" link, so it doesn't lead to a real PayPal page that can't know this invoice
  m = path.match(/^\/invoice\/p\/([^/]+)$/);
  if (m && method === 'GET') {
    return [200, `<!doctype html><meta charset="utf-8"><title>Simulated invoice</title>
<body style="font:18px system-ui;max-width:560px;margin:80px auto;color:#0f172a">
<h1 style="font-size:24px">Simulated invoice ${m[1]}</h1>
<p>This PayPilot demo is running against a simulated PayPal API, so there is no real checkout. Use <b>Record payment</b> in PayPilot instead.</p></body>`];
  }

  return notFound();
}

createServer((req, res) => {
  let raw = '';
  req.on('data', (d) => (raw += d));
  req.on('end', () => {
    const url = new URL(req.url, BASE);
    let body;
    try {
      body = raw && req.headers['content-type']?.includes('json') ? JSON.parse(raw) : undefined;
    } catch {
      body = undefined;
    }
    const [status, payload] = route(req.method, url.pathname, url.searchParams, body);
    console.log(`${req.method} ${url.pathname} → ${status}`);
    if (payload === undefined) {
      res.writeHead(status).end();
    } else if (typeof payload === 'string') {
      res.writeHead(status, { 'Content-Type': 'text/html; charset=utf-8' }).end(payload);
    } else {
      res.writeHead(status, { 'Content-Type': 'application/json' }).end(JSON.stringify(payload));
    }
  });
}).listen(PORT, () => console.log(`Simulated PayPal API on ${BASE}`));
