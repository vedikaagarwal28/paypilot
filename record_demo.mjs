// Records the DEMO_SCRIPT.md walkthrough with Playwright and saves one continuous raw_demo.webm.
//
//   node record_demo.mjs [--timings beats.json] [--out path.webm] [--no-reset] [--headed] [--smoke]
//
// Each step lasts at least as long as its spoken line (narration clip length from --timings, otherwise
// estimated from the word count). Steps that wait on the app or PayPal run longer; build.py speeds those up.
// PayPal opens in a popup, which Playwright records as a separate video. The script tracks which window is
// in front and splices the videos into one timeline. Step start times are written to <out>.markers.json.
//
// --smoke records a short check of the cursor, a popup and the splice without touching the demo data.
// --simulate-paypal runs scripts/mock-paypal.mjs and points the app at it instead of PayPal (no sandbox account
// needed). The app labels itself "PayPal simulated" and the payment step uses Record payment.

import 'dotenv/config';
import { spawn, spawnSync } from 'node:child_process';
import { mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const args = process.argv.slice(2);
const flag = (name) => args.includes(name);
const opt = (name, fallback) => (args.includes(name) ? args[args.indexOf(name) + 1] : fallback);

const BASE = process.env.APP_URL?.startsWith('http://localhost') ? process.env.APP_URL : 'http://localhost:3000';
const OUT = path.resolve(opt('--out', path.join(os.homedir(), 'Downloads', 'raw_demo.webm')));
const WORK = path.join(os.tmpdir(), 'paypilot-recording');
const W = 1920;
const H = 1080;
// The app is zoomed to 150% so the UI reads well on video. (Playwright records at viewport size, so a higher
// deviceScaleFactor doesn't help.) PayPal's pages stay at 100%.
const APP_ZOOM = 1.5;
const GAP = 0.6; // matches the pause build.py leaves after each line

const ACME_BUYER = 2; // Acme Corp pays with the third sandbox buyer (see src/lib/demo/seed-data.ts)
const EDIT_LINE = "\n\nIf something is holding this up, just reply and I'll help sort it out.";

const t0 = Date.now();
const log = (msg) => console.log(`[${((Date.now() - t0) / 1000).toFixed(1).padStart(6)}s] ${msg}`);
const sleep = (ms) => new Promise((r) => setTimeout(r, Math.max(0, ms)));

// ---------- step lengths ----------

function scriptLines() {
  const lines = [];
  for (const line of readFileSync(new URL('./DEMO_SCRIPT.md', import.meta.url), 'utf8').split(/\r?\n/)) {
    const m = line.match(/^\| (\d:\d\d) \| .+? \| "(.+)" \|$/);
    if (m) lines.push(m[2]);
  }
  return lines;
}

function stepSeconds() {
  const timings = opt('--timings');
  if (timings) return JSON.parse(readFileSync(timings, 'utf8')).map((b) => b.seconds + GAP);
  return scriptLines().map((s) => s.split(/\s+/).length / 2.5 + GAP);
}

// ---------- simulated PayPal ----------

const MOCK_PORT = 4010;

async function startMockPayPal() {
  const child = spawn(process.execPath, [fileURLToPath(new URL('./scripts/mock-paypal.mjs', import.meta.url)), String(MOCK_PORT)],
    { stdio: ['ignore', 'pipe', 'inherit'] });
  await new Promise((resolve, reject) => {
    child.stdout.once('data', resolve);
    child.once('exit', (code) => reject(new Error(`simulated PayPal API exited (${code})`)));
  });
  // Inherited by the dev server and the demo reset. Next and dotenv never override variables that are already set.
  Object.assign(process.env, {
    PAYPAL_API_BASE: `http://localhost:${MOCK_PORT}`,
    PAYPAL_CLIENT_ID: 'simulated',
    PAYPAL_CLIENT_SECRET: 'simulated',
    PAYPAL_WEBHOOK_ID: '',
    SANDBOX_BUYER_EMAILS: 'brightline@example.com,orbit@example.com,acme@example.com',
    SANDBOX_COLLAB_EMAILS: 'maya@example.com,leo@example.com',
    RESEND_API_KEY: '',
    DEMO_INBOX_EMAIL: '',
  });
  delete process.env.SANDBOX_BUYER_PASSWORDS;
  log(`simulated PayPal API on http://localhost:${MOCK_PORT}`);
  return child;
}

// ---------- dev server ----------

async function healthy() {
  try {
    return (await fetch(`${BASE}/api/health`, { signal: AbortSignal.timeout(3000) })).ok;
  } catch {
    return false;
  }
}

async function startServer() {
  if (await healthy()) {
    if (flag('--simulate-paypal')) throw new Error(`stop the dev server at ${BASE} first: it has to start with the simulated PayPal settings`);
    log(`dev server already running at ${BASE}`);
    return null;
  }
  log('starting dev server');
  const child = spawn('npm', ['run', 'dev'], { shell: true, stdio: ['ignore', 'pipe', 'pipe'] });
  let output = '';
  child.stdout.on('data', (d) => (output += d));
  child.stderr.on('data', (d) => (output += d));
  for (let i = 0; i < 90; i++) {
    if (await healthy()) {
      log('dev server ready');
      return child;
    }
    if (child.exitCode !== null) throw new Error(`dev server exited:\n${output}`);
    await sleep(2000);
  }
  throw new Error(`dev server not healthy after 3 minutes:\n${output}`);
}

function stopServer(child) {
  if (!child) return;
  if (process.platform === 'win32') spawnSync('taskkill', ['/pid', String(child.pid), '/T', '/F']);
  else child.kill('SIGTERM');
}

// Next compiles each route on first request; do that now so no compile spinner shows up on camera.
async function warmUp() {
  log('warming up routes');
  const routes = ['/', '/invoices', '/cashflow', '/activity', '/settings',
    '/api/dashboard', '/api/invoices', '/api/cashflow', '/api/activity', '/api/settings', '/api/collaborators',
    // POST-only routes: a GET returns 405 without running anything, but still compiles them
    '/api/agent/run', '/api/chat', '/api/actions/0', '/api/actions/0/redraft', '/api/invoices/0/record-payment'];
  for (const r of routes) await fetch(BASE + r, { signal: AbortSignal.timeout(120_000) }).catch(() => {});
}

function resetDemo() {
  log('resetting demo (about 30 s)');
  const r = spawnSync('npm', ['run', 'demo:reset'], { shell: true, encoding: 'utf8' });
  if (r.status !== 0) throw new Error(`demo reset failed:\n${r.stdout}\n${r.stderr}`);
}

async function checkData() {
  const res = await fetch(`${BASE}/api/invoices`);
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(`the app can't load invoices (${res.status}): ${body.error ?? 'unknown error'}. Check .env.`);
}

// ---------- cursor + click highlight ----------

// Drawn from Node on every move (not from DOM mouse events), so it also tracks over cross-origin iframes
// like PayPal's buttons and survives full page loads.
function cursorScript([x, y, click, ms]) {
  const ID = '__demo_cursor';
  let c = document.getElementById(ID);
  if (!c) {
    c = document.createElement('div');
    c.id = ID;
    Object.assign(c.style, { position: 'fixed', left: '0', top: '0', width: '28px', height: '28px', zIndex: '2147483647', pointerEvents: 'none', transition: 'none' });
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('viewBox', '0 0 24 24');
    svg.setAttribute('width', '28');
    svg.setAttribute('height', '28');
    const p = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    p.setAttribute('d', 'M3 2l7.5 19 2.6-7.9L21 10.5z');
    p.setAttribute('fill', '#111');
    p.setAttribute('stroke', '#fff');
    p.setAttribute('stroke-width', '1.6');
    p.setAttribute('stroke-linejoin', 'round');
    svg.appendChild(p);
    c.appendChild(svg);
    (document.body ?? document.documentElement).appendChild(c);
  }
  // x/y are viewport pixels; inside a zoomed page CSS pixels are bigger, so divide
  const z = parseFloat(getComputedStyle(document.documentElement).zoom) || 1;
  c.style.transition = ms ? `transform ${ms}ms cubic-bezier(.45,0,.25,1)` : 'none';
  c.style.transform = `translate(${(x - 3) / z}px, ${(y - 2) / z}px)`;
  // Next.js dev badge
  document.querySelectorAll('nextjs-portal').forEach((e) => (e.style.display = 'none'));
  if (click) {
    const r = document.createElement('div');
    Object.assign(r.style, { position: 'fixed', left: `${x / z - 22}px`, top: `${y / z - 22}px`, width: '44px', height: '44px', borderRadius: '50%', background: 'rgba(0,112,224,0.35)', border: '2px solid rgba(0,112,224,0.9)', zIndex: '2147483646', pointerEvents: 'none' });
    (document.body ?? document.documentElement).appendChild(r);
    r.animate([{ transform: 'scale(0.4)', opacity: 1 }, { transform: 'scale(1.6)', opacity: 0 }], { duration: 550, easing: 'ease-out' }).onfinish = () => r.remove();
  }
}

const pos = new WeakMap();

async function drawCursor(page, x, y, click = false, ms = 0) {
  await page.evaluate(cursorScript, [x, y, click, ms]).catch(() => {});
}

function trackCursor(page) {
  pos.set(page, { x: W / 2, y: H / 2 });
  page.on('pageerror', (e) => log(`page error: ${e.message}\n${(e.stack ?? '').split('\n').slice(1, 6).join('\n')}`));
  page.on('load', () => drawCursor(page, pos.get(page).x, pos.get(page).y));
}

// The drawn cursor animates with a CSS transition (one call, exact timing); the real mouse follows in a few
// steps so hover states still trigger along the way.
async function glide(page, x, y, ms = 700) {
  const begin = Date.now();
  await drawCursor(page, x, y, false, ms);
  await page.mouse.move(x, y, { steps: 6 });
  await sleep(ms - (Date.now() - begin));
  pos.set(page, { x, y });
}

async function center(locator) {
  await locator.scrollIntoViewIfNeeded();
  const b = await locator.boundingBox();
  if (!b) throw new Error(`not visible: ${locator}`);
  return { x: b.x + Math.min(b.width / 2, 120), y: b.y + b.height / 2 };
}

async function hover(page, locator, ms) {
  const { x, y } = await center(locator);
  await glide(page, x, y, ms);
}

async function click(page, locator, ms) {
  await hover(page, locator, ms);
  const { x, y } = pos.get(page);
  await drawCursor(page, x, y, true);
  await sleep(120);
  await page.mouse.click(x, y);
}

async function scrollBy(page, dy, ms = 1200) {
  const steps = Math.round(ms / 40);
  for (let i = 0; i < steps; i++) {
    await page.mouse.wheel(0, dy / steps);
    await sleep(40);
  }
}

// ---------- which window is on camera ----------

class Timeline {
  constructor() {
    this.pages = []; // { page, created }
    this.segments = []; // { page, from, to } in ms since the epoch
    this.front = null;
  }
  add(page) {
    const entry = { page, closed: null };
    this.pages.push(entry);
    this.show(page);
    page.on('close', () => {
      entry.closed = Date.now();
      if (this.front !== page) return;
      const back = [...this.pages].reverse().find((p) => !p.page.isClosed() && p.page !== page);
      if (back) this.show(back.page);
    });
  }
  show(page) {
    const now = Date.now();
    if (this.front) this.segments.at(-1).to = now;
    this.segments.push({ page, from: now, to: null });
    this.front = page;
  }
  finish() {
    this.segments.at(-1).to = Date.now();
  }
}

function videoSeconds(file) {
  const r = spawnSync('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', file], { encoding: 'utf8' });
  return parseFloat(r.stdout);
}

async function splice(timeline, startAt, out) {
  const inputs = [];
  const parts = [];
  for (const s of timeline.segments) {
    const from = Math.max(s.from, startAt);
    if (s.to - from < 100) continue;
    const entry = timeline.pages.find((p) => p.page === s.page);
    const file = await s.page.video().path();
    let idx = inputs.indexOf(file);
    if (idx < 0) idx = inputs.push(file) - 1;
    // A window's video starts at its first paint, not when Playwright reports the page, but it ends when the
    // window closes, so line it up from the end.
    const videoStart = entry.closed - videoSeconds(file) * 1000;
    const a = Math.max(0, (from - videoStart) / 1000);
    const b = (s.to - videoStart) / 1000;
    const len = (s.to - from) / 1000;
    // tpad keeps the segment at its wall-clock length if the video is short, so the step markers stay true
    parts.push(`[${idx}:v]trim=start=${a.toFixed(3)}:end=${b.toFixed(3)},setpts=PTS-STARTPTS,fps=30,scale=${W}:${H},setsar=1,` +
      `tpad=stop_mode=clone:stop_duration=1,trim=duration=${len.toFixed(3)}[p${parts.length}]`);
  }
  const labels = parts.map((_, i) => `[p${i}]`).join('');
  const filter = `${parts.join(';')};${labels}concat=n=${parts.length}:v=1:a=0[v]`;
  log(`splicing ${parts.length} segment(s) from ${inputs.length} window video(s)`);
  const r = spawnSync('ffmpeg', ['-y', '-v', 'error', ...inputs.flatMap((f) => ['-i', f]),
    '-filter_complex', filter, '-map', '[v]',
    '-c:v', 'libvpx-vp9', '-crf', '28', '-b:v', '0', '-deadline', 'good', '-cpu-used', '5', '-row-mt', '1', out],
  { encoding: 'utf8' });
  if (r.status !== 0) throw new Error(`ffmpeg failed:\n${r.stderr}`);
}

// ---------- PayPal sandbox checkout ----------

function buyerCredentials() {
  const emails = (process.env.SANDBOX_BUYER_EMAILS ?? '').split(',').map((s) => s.trim());
  const passwords = (process.env.SANDBOX_BUYER_PASSWORDS ?? '').split(',').map((s) => s.trim());
  const email = emails[ACME_BUYER];
  const password = passwords[ACME_BUYER] ?? passwords[0];
  if (!email || !password) throw new Error('Set SANDBOX_BUYER_EMAILS and SANDBOX_BUYER_PASSWORDS in .env (same order)');
  return { email, password };
}

// Returns the first visible match across the page and its frames.
async function findVisible(page, selectors, timeoutMs) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    for (const frame of page.frames()) {
      for (const sel of selectors) {
        const loc = frame.locator(sel).first();
        if (await loc.isVisible().catch(() => false)) return loc;
      }
    }
    await sleep(300);
  }
  return null;
}

async function shot(page, name) {
  mkdirSync(WORK, { recursive: true });
  const file = path.join(WORK, `${name}.png`);
  await page.screenshot({ path: file }).catch(() => {});
  return file;
}

async function checkout(context, pp) {
  const { email, password } = buyerCredentials();
  await pp.waitForLoadState('domcontentloaded');
  log(`PayPal: ${pp.url().split('#')[0]}`);

  // Invoice payer view → PayPal button (may be in an iframe, may open another popup)
  const payButton = await findVisible(pp, [
    'button:has-text("Pay Now")', 'a:has-text("Pay Now")', '[data-funding-source="paypal"]',
    'button:has-text("Pay with PayPal")', '[aria-label*="PayPal" i][role="link"]', '[aria-label*="PayPal" i][role="button"]',
  ], 30_000);
  if (!payButton) throw new Error(`PayPal: no pay button found (screenshot: ${await shot(pp, 'paypal-invoice')})`);
  const nextPopup = context.waitForEvent('page', { timeout: 8000 }).catch(() => null);
  await click(pp, payButton, 900);
  const loginPage = (await nextPopup) ?? pp;
  if (loginPage !== pp) trackCursor(loginPage);
  await loginPage.waitForLoadState('domcontentloaded');

  // Login: email, then (sometimes on a second screen) password
  const emailBox = await findVisible(loginPage, ['#email', 'input[name="login_email"]'], 30_000);
  if (emailBox) {
    await click(loginPage, emailBox, 600);
    await emailBox.fill('');
    await loginPage.keyboard.type(email, { delay: 35 });
    const next = await findVisible(loginPage, ['#btnNext'], 1500);
    if (next) await click(loginPage, next, 500);
    const pw = await findVisible(loginPage, ['#password', 'input[name="login_password"]'], 20_000);
    if (!pw) throw new Error(`PayPal: no password field (screenshot: ${await shot(loginPage, 'paypal-login')})`);
    await click(loginPage, pw, 500);
    await loginPage.keyboard.type(password, { delay: 35 });
    await click(loginPage, await findVisible(loginPage, ['#btnLogin', 'button[type="submit"]'], 5000), 500);
  } else {
    log('PayPal: no login form, assuming the buyer is already signed in');
  }

  // Review → pay
  const submit = await findVisible(loginPage, [
    '#payment-submit-btn', '[data-testid="submit-button-initial"]', 'button:has-text("Complete Purchase")',
    'button:has-text("Pay Now")', 'button:has-text("Pay $")', 'button:has-text("Continue")',
  ], 45_000);
  if (!submit) throw new Error(`PayPal: no pay/confirm button (screenshot: ${await shot(loginPage, 'paypal-review')})`);
  await click(loginPage, submit, 900);

  // Done when the login popup closes or a confirmation shows on the invoice page
  const done = await Promise.race([
    loginPage !== pp ? loginPage.waitForEvent('close', { timeout: 60_000 }).then(() => true).catch(() => false) : new Promise(() => {}),
    findVisible(pp, ['text=/you paid|payment (sent|complete)|thank you|paid/i'], 60_000).then(Boolean),
  ]);
  if (!done) throw new Error(`PayPal: payment not confirmed (screenshot: ${await shot(pp, 'paypal-after')})`);
  await findVisible(pp, ['text=/you paid|payment (sent|complete)|thank you|paid/i'], 15_000);
  await sleep(1500);
  for (const p of context.pages()) if (p !== context.pages()[0]) await p.close();
}

// ---------- the "how it works" slide ----------

const DIAGRAM = `<!doctype html><html style="zoom:${APP_ZOOM}"><head><meta charset="utf-8"><style>
  /* top 130px stays clear for the "PayPal APIs used" banner added in the edit */
  body { margin: 0; height: calc(100vh / ${APP_ZOOM}); display: flex; flex-direction: column; justify-content: center; gap: 40px;
         font-family: "Segoe UI", system-ui, sans-serif; background: #f6f8fb; color: #0f172a; padding: 130px 32px 40px; box-sizing: border-box; }
  .row { display: flex; align-items: center; justify-content: center; gap: 16px; }
  .box { background: #fff; border: 2px solid #cbd5e1; border-radius: 14px; padding: 18px 20px; width: 232px; transition: all .4s; }
  .box b { display: block; font-size: 19px; margin-bottom: 6px; }
  .box span { font-size: 14px; color: #475569; }
  .arrow { font-size: 28px; color: #94a3b8; }
  .on { border-color: #0070e0; box-shadow: 0 0 0 5px rgba(0,112,224,.18); transform: translateY(-3px); }
  .note { background: #eef2f7; border-style: dashed; }
</style></head><body>
  <div class="row">
    <div class="box" id="invoicing"><b>PayPal Invoicing API</b><span>create, send, write the note, remind</span></div>
    <div class="arrow">→</div>
    <div class="box" id="pays"><b>Client pays</b><span>PayPal checkout</span></div>
    <div class="arrow">→</div>
    <div class="box" id="webhook"><b>PayPal webhook</b><span>signature checked, payment confirmed</span></div>
    <div class="arrow">→</div>
    <div class="box" id="payouts"><b>PayPal Payouts API</b><span>each collaborator's share, once</span></div>
  </div>
  <div class="row">
    <div class="box note" id="risk"><b>Risk score</b><span>plain code, no AI</span></div>
    <div class="box note" id="words"><b>Gemini</b><span>writes the reminder text only</span></div>
    <div class="box note" id="copilot"><b>Copilot</b><span>reads invoices via PayPal Agent Toolkit</span></div>
  </div>
</body></html>`;

async function highlight(page, ids) {
  await page.evaluate((on) => {
    document.querySelectorAll('.box').forEach((b) => b.classList.toggle('on', on.includes(b.id)));
  }, ids);
}

// ---------- the walkthrough, one function per spoken line ----------

// A stylesheet survives React hydration and client-side navigation; a style attribute on <html> doesn't.
async function openApp(page, route) {
  await page.goto(BASE + route);
  await page.addStyleTag({ content: `html { zoom: ${APP_ZOOM}; }` });
  await drawCursor(page, pos.get(page).x, pos.get(page).y);
}

const nav = (page, label) => page.locator('header nav').first().getByRole('link', { name: label, exact: true });

function demoSteps(context, page) {
  return [
    // 1. problem
    async () => {
      await hover(page, page.getByRole('heading', { name: 'Today' }), 900);
    },
    // 2.
    async () => {
      await sleep(1500);
      await hover(page, page.getByRole('button', { name: 'Run agent' }), 1400);
    },
    // 3. run the agent
    async () => {
      await sleep(2500);
      await click(page, page.getByRole('button', { name: 'Run agent' }), 400);
      await page.getByRole('button', { name: 'Run agent' }).waitFor({ timeout: 180_000 });
      log('agent run finished');
      await sleep(1500);
      if (await page.getByText('Template draft:').count()) throw new RetakeError('the AI was unavailable for a draft, so a template was used');
    },
    // 4. auto-sent gentle reminder
    async () => {
      await hover(page, page.getByText('Sent automatically', { exact: true }), 900);
      await sleep(2500);
      await hover(page, page.locator('aside').getByText(/Brightline/).first(), 1100);
    },
    // 5. Acme waits for approval
    async () => {
      const card = acmeCard(page);
      await hover(page, card.getByText('Why this tone:'), 1100);
      await sleep(3000);
      await hover(page, card.getByText('Why it waits for you:'), 900);
    },
    // 6. edit a line, approve
    async () => {
      const card = acmeCard(page);
      const message = card.getByRole('textbox', { name: 'Message' });
      await click(page, message, 800);
      await page.keyboard.press('Control+End');
      await page.keyboard.type(EDIT_LINE, { delay: 28 });
      await click(page, card.getByRole('button', { name: 'Approve & send' }), 900);
      await page.getByText(/Reminder sent to Acme Corp|PayPal rejected it/).first().waitFor({ timeout: 60_000 });
      log('Acme reminder approved');
    },
    // 7. open Acme's invoice and its split
    async () => {
      await click(page, nav(page, 'Invoices'), 900);
      const row = page.locator('.ag-row').filter({ hasText: 'Acme Corp' }).first();
      await row.waitFor({ timeout: 30_000 });
      await sleep(600);
      await click(page, row.locator('.ag-cell').first(), 900);
      const split = page.getByRole('dialog').getByRole('heading', { name: 'Split with collaborators' });
      await split.waitFor();
      await hover(page, split, 1000);
    },
    // 8. pay as the client in the PayPal popup, or, without buyer passwords, the app's Record payment
    // fallback (marks the real sandbox invoice paid through the API; same payouts follow)
    async () => {
      if (!process.env.SANDBOX_BUYER_PASSWORDS) {
        log('no SANDBOX_BUYER_PASSWORDS: using Record payment instead of the PayPal checkout');
        await click(page, page.getByRole('button', { name: 'Record payment' }), 1000);
        await page.getByText('Payment recorded in PayPal').first().waitFor({ timeout: 60_000 });
        log('payment recorded');
        return;
      }
      const popup = context.waitForEvent('page');
      await click(page, page.getByRole('link', { name: /Pay as client in PayPal/ }), 900);
      const pp = await popup;
      trackCursor(pp);
      await checkout(context, pp);
      await page.bringToFront();
      log('payment done');
    },
    // 9. payouts land
    async () => {
      await page.keyboard.press('Escape');
      await click(page, nav(page, 'Cash flow'), 900);
      const payouts = page.locator('table');
      await payouts.getByText('Maya Chen').waitFor({ timeout: 240_000 });
      await payouts.getByText('Leo Park').waitFor({ timeout: 60_000 });
      log('payouts shown');
      await hover(page, payouts.getByText('Maya Chen'), 900);
      await sleep(1200);
      await hover(page, payouts.getByText('Leo Park'), 700);
    },
    // 10. activity log
    async () => {
      await click(page, nav(page, 'Activity'), 900);
      await page.getByRole('heading', { name: 'Activity' }).waitFor();
      await glide(page, W / 2, H / 2, 500);
      await scrollBy(page, 900, 1800);
    },
    // 11. how it works: invoicing
    async () => {
      await page.setContent(DIAGRAM);
      await drawCursor(page, pos.get(page).x, pos.get(page).y);
      await sleep(800);
      await highlight(page, ['invoicing']);
      await hover(page, page.locator('#invoicing'), 900);
    },
    // 12. webhook → payouts
    async () => {
      await highlight(page, ['pays', 'webhook', 'payouts']);
      await hover(page, page.locator('#webhook'), 900);
      await sleep(3500);
      await hover(page, page.locator('#payouts'), 900);
    },
    // 13. risk score, Gemini, Agent Toolkit
    async () => {
      await highlight(page, ['copilot']);
      await hover(page, page.locator('#copilot'), 900);
      await sleep(3200);
      await highlight(page, ['risk', 'words']);
      await hover(page, page.locator('#risk'), 900);
    },
    // 14. back to Today
    async () => {
      await openApp(page, '/');
      await page.getByText('Sent automatically', { exact: true }).waitFor();
      await hover(page, page.getByText('Waiting for you', { exact: true }), 1000);
    },
    // 15. end card (title is overlaid in the edit)
    async () => {
      await glide(page, W - 200, H - 150, 1200);
    },
  ];
}

const acmeCard = (page) =>
  page.locator('[data-slot="card"]').filter({ has: page.getByRole('link', { name: 'Acme Corp', exact: true }) }).first();

function smokeSteps(context, page) {
  return [
    async () => {
      await hover(page, page.getByRole('heading', { name: 'Today' }), 800);
    },
    async () => {
      const popup = context.waitForEvent('page');
      await page.evaluate(() => {
        const w = window.open('about:blank', '_blank');
        w.document.write('<body style="margin:0;display:grid;place-items:center;height:100vh;background:#003087;color:#fff;font:48px Segoe UI">Popup window</body>');
      });
      const pp = await popup;
      trackCursor(pp);
      await glide(pp, 900, 500, 900);
      await drawCursor(pp, 900, 500, true);
      await sleep(1500);
      await pp.close();
      await page.bringToFront();
    },
    async () => {
      await click(page, nav(page, 'Settings'), 900);
      await page.getByRole('heading', { name: 'Settings' }).waitFor({ timeout: 30_000 });
    },
    async () => {
      await page.setContent(DIAGRAM);
      await highlight(page, ['webhook', 'payouts']);
      await hover(page, page.locator('#webhook'), 900);
    },
  ];
}

// ---------- main ----------

/** A take that would look wrong on video (e.g. template drafts while Gemini's free tier is overloaded). */
class RetakeError extends Error {}

const MAX_TAKES = 4;

async function recordTake(browser, smoke, durations) {
  rmSync(WORK, { recursive: true, force: true });
  mkdirSync(WORK, { recursive: true });
  const context = await browser.newContext({
    viewport: { width: W, height: H },
    recordVideo: { dir: WORK, size: { width: W, height: H } },
  });
  try {
    const timeline = new Timeline();
    context.on('page', (p) => timeline.add(p));
    const page = await context.newPage();
    trackCursor(page);
    await openApp(page, '/');
    await page.getByRole('button', { name: 'Run agent' }).waitFor({ timeout: 60_000 });
    await drawCursor(page, W / 2, H / 2);
    await sleep(1000);

    const steps = smoke ? smokeSteps(context, page) : demoSteps(context, page);
    if (steps.length !== durations.length) throw new Error(`${steps.length} steps but ${durations.length} script lines`);
    const startAt = Date.now();
    const starts = [];
    for (const [i, step] of steps.entries()) {
      const begin = Date.now();
      starts.push((begin - startAt) / 1000);
      log(`step ${i + 1}/${steps.length} (${durations[i].toFixed(1)}s)`);
      try {
        await step();
      } catch (e) {
        if (e instanceof RetakeError) throw e;
        throw new Error(`step ${i + 1} failed: ${e.message}\nscreenshot: ${await shot(timeline.front ?? page, `failed-step-${i + 1}`)}`);
      }
      await sleep(durations[i] * 1000 - (Date.now() - begin));
    }
    const end = (Date.now() - startAt) / 1000;
    timeline.finish();
    await context.close();

    mkdirSync(path.dirname(OUT), { recursive: true });
    await splice(timeline, startAt, OUT);
    writeFileSync(OUT.replace(/\.webm$/, '') + '.markers.json', JSON.stringify({ starts, end }, null, 2));
    log(`saved ${OUT} (${end.toFixed(1)} s) and its markers`);
  } finally {
    await context.close().catch(() => {});
  }
}

async function main() {
  const smoke = flag('--smoke');
  const durations = smoke ? [2, 4, 3, 3] : stepSeconds();
  const mock = flag('--simulate-paypal') ? await startMockPayPal() : null;
  let server;
  let browser;
  try {
    server = await startServer();
    if (!smoke) {
      await checkData();
      if (!flag('--no-reset')) resetDemo();
      await warmUp();
    }

    browser = await chromium.launch({ headless: !flag('--headed') });
    for (let take = 1; ; take++) {
      try {
        await recordTake(browser, smoke, durations);
        break;
      } catch (e) {
        if (!(e instanceof RetakeError) || take >= MAX_TAKES || flag('--no-reset')) throw e;
        log(`take ${take} discarded: ${e.message}. Resetting for take ${take + 1}`);
        resetDemo();
      }
    }
  } finally {
    await browser?.close();
    stopServer(server);
    stopServer(mock);
  }
}

main().catch((e) => {
  console.error(e.message ?? e);
  process.exitCode = 1;
});
