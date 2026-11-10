# Appendix A — Design spec (copied to `docs/superpowers/specs/2026-11-10-paypilot-design.md`)

## Context
PayPal AI Hackathon (Devpost). Submission closes Thu Nov 12, 2026, 12:00 PT. The team is 2 web devs going hard; the repo was empty and no accounts existed. Required: a working build (hosted URL and/or run instructions), a public repo with a visible OSI license, a public YouTube video < 3 min, and an English description. Five equally weighted criteria: Tech Implementation, Design, Impact, Innovation, Presentation. Targets: Grand / Best Use of PayPal + AI / Best Use of Agentic Commerce, plus the AG Grid and Render sponsor prizes.

## Intent
PayPilot is an AI collections and payout copilot for freelancers and tiny studios that bill through PayPal invoices. It acts rather than just reporting. An agent scores late-payment risk and explains it, drafts tone-matched reminders, and sends them through PayPal, on its own under user rules or after approval. When a client pays, a webhook triggers automatic split payouts to collaborators. A copilot chat answers questions and takes the same gated actions. The agent's decisions and their reasons are always visible and auditable.

## Goals
1. One real end-to-end loop on the PayPal sandbox: invoices → risk → draft → approve/auto → reminder → client pays → webhook → split payout → cash flow.
2. A supervised agent: rules plus an approval queue.
3. Hosted on Render with a "Reset demo" control.
4. A demo that fits in < 3 min.

## Non-goals
Disputes, multi-currency, real auth/multi-tenant, SMS, inbound email, mobile, trained ML, Subscriptions/Pay Later.

## Anti-goals
- AI that sends money or email with no visible reason or control.
- Mocked PayPal presented as real.
- A demo that depends on luck.
- Passing off seeded history as real.

## Decisions
**User's decisions:** Next.js + TypeScript; 2-day push; rules + approval queue; AI reminders also delivered as real email via Resend.

**Builder's calls:**
- Claude via AI SDK v4
- PayPal Agent Toolkit for read tools
- Neon Postgres + Drizzle
- Render hosting
- AG Grid Community
- No auth
- 3 s polling
- MIT license
- PayPal as source of truth for invoice state
- Tone from score bands
- A general `pending_actions` queue
- Reset = cancel old batch + reseed, 5-min cooldown
- Demo clock offset if back-dating is rejected

## How it works
- **Sandbox cast:** 1 business account (the freelancer), 3 buyer accounts (clients), 2 collaborator accounts. The seed creates 6 clients with synthetic histories and 6 real invoices (5 open, 1 paid), plus splits on 2 invoices.
- **Risk:** deterministic 0–100 from days overdue, average days late, % paid late, ignored reminders, amount vs usual, and reminders already sent. Tone comes from the band (<40 / 40–69 / ≥70). The LLM writes only the explanation and the message.
- **Agent tools:** read invoices (toolkit), risk report, client profile, draft reminder, create invoice (draft is immediate, sending is gated), cash flow, pending actions. All sends go through the policy gate, and every action is logged with a reason.
- **Reminder delivery:** AI text → PayPal invoice note (PUT) → PayPal `remind` → Resend email with the pay link.
- **Payment:** `INVOICING.INVOICE.PAID` webhook (signature-verified) or polling sync → idempotent split payouts via Payouts v1 → payout webhooks update status.
- **Screens:** Today (summary + approval queue), Invoices (AG Grid), Client, Cash flow, Settings, Activity; Copilot drawer everywhere.

## Demo video (≤ 3:00)
1. **0:00–0:20** Problem: freelancers chase late invoices and split income by hand.
2. **0:20–1:10** Run agent. The risk grid shows reasons; a gentle reminder auto-sends under a rule shown on screen; a firm one queues; edit and approve; the email lands.
3. **1:10–1:50** Chat: "Who's likely to pay late?" then "Invoice Brightline $1,200, split 30% to Maya". A real draft is created and approved.
4. **1:50–2:35** Pay as the client in sandbox PayPal. The webhook arrives, split payouts run, and the cash flow and activity views update live.
5. **2:35–3:00** Recap: PayPal APIs + Claude, and who it helps.

## Left to the builder
Component styling, exact prompt wording beyond the stated rules, chart styling, error-message wording beyond the copy pinned in the plan.
