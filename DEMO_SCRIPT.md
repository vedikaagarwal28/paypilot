# PayPilot demo script (2:30)

About 370 spoken words, which is a calm pace for 2½ minutes. The waits (agent run, PayPal checkout, payout landing) are marked **[cut]**. Trim them in the edit so the voice-over runs straight through.

---

## Before you record

This version is recorded with `node record_demo.mjs --simulate-paypal`. That runs the real app against a simulated PayPal API (`scripts/mock-paypal.mjs`) because no sandbox account was available. The app's header shows "PayPal simulated", and the narration says so at 0:20. With a sandbox account, record without the flag and put back the checkout lines at 1:08–1:28.

- [ ] Open the app at least 2 minutes early so Render is awake (load `/api/health`).
- [ ] **Settings → Reset demo**, wait about 30 s, then go to **Today** and **don't** run the agent yet.
- [ ] Browser tab 2: sandbox PayPal (`sandbox.paypal.com`), already logged in as the **buyer account for Acme Corp** (buyer #3 in `SANDBOX_BUYER_EMAILS`). That makes checkout one click.
- [ ] Tab 3 (optional): the Resend inbox (`DEMO_INBOX_EMAIL`), in case you want a 2-second shot of the reminder email.
- [ ] Close other tabs, turn off notifications, zoom the browser to 110–125% so text is readable on video.
- [ ] Backup: if sandbox checkout fails, use **Record payment** in the same invoice panel. It triggers the same payouts.

---

## 1. The problem and who it affects (0:00–0:20)

| Time | On screen | Say |
|---|---|---|
| 0:00 | PayPilot **Today** page, before the agent runs. | "If you freelance, getting paid is a second job. The due date passes, and now you have to chase the client without sounding rude." |
| 0:10 | Same page. Slowly move the cursor over to **Run agent**. | "Then, when the money finally comes in, you have to pay the designer or writer who helped you, by hand. PayPilot does both of those jobs." |

## 2. Live demo (0:20–1:45)

| Time | On screen | Say |
|---|---|---|
| 0:20 | Click **Run agent**. The button changes to "Agent is working…". **[cut the wait]** | "These are my open invoices. The clients are sample data, and PayPal's side is simulated for this recording. I click Run agent." |
| 0:30 | Stats fill in: **Sent automatically: 1**, **Waiting for you: 3**. Point at the Brightline line under **Recent agent actions**. | "It checks how likely each client is to pay late. Brightline usually pays on time and owes $350, so under my rules it gets a gentle reminder, sent on its own." |
| 0:42 | Scroll to the **Acme Corp** card. Highlight **Why this tone** and **Why it waits for you**. | "Acme owes $1,800 and paid four of their last five invoices late. That's over my limit, so this one waits for me, and it tells me why it chose this tone." |
| 0:52 | Edit one sentence in the message, then click **Approve & send**. Success toast appears. | "I change one line and approve. My message goes onto the PayPal invoice, and PayPal sends the reminder." |
| 1:08 | Close Copilot. Go to **Invoices**, click the **Acme Corp** row. Panel opens showing the split: Maya 30%, Leo 20%. | "This invoice is shared: 30% goes to Maya, my designer, and 20% to Leo, my copywriter." |
| 1:18 | Click **Record payment** in the same panel. **[cut the wait]** | "Acme pays the $1,800, and I record the payment on the invoice." |
| 1:28 | Switch to **Cash flow**. **Collaborator payouts** shows Maya $540 and Leo $360. **[cut until the rows appear]** | "PayPilot sees the payment and sends Maya $540 and Leo $360 through PayPal Payouts. I didn't do anything." |
| 1:38 | Open **Activity**. Scroll the list from reminder to payment to payouts. | "Every step is logged here, with the reason it happened." |

## 3. How it works and which PayPal APIs (1:45–2:15)

| Time | On screen | Say |
|---|---|---|
| 1:45 | A simple diagram slide: *Invoices → reminder → client pays → webhook → payouts* (or the "How it works" diagram from the README). | "Here's what's behind it. The PayPal Invoicing API creates the invoices, puts my message on them, and sends the reminders." |
| 1:53 | Highlight *webhook → payouts* on the diagram. | "When a client pays, a PayPal webhook tells the app. The app checks the signature, confirms the payment with PayPal, then uses the Payouts API to pay each collaborator their share, once." |
| 2:04 | Highlight *risk score* and *Copilot* on the diagram. | "The chat reads invoices through PayPal's Agent Toolkit. The risk score is plain code, not AI. Gemini only writes the words, so it can't make up a number." |

## 4. Impact and closing (2:15–2:30)

| Time | On screen | Say |
|---|---|---|
| 2:15 | Back to **Today**: queue cleared, stats showing. | "PayPilot is for freelancers and small studios who bill through PayPal. You spend less time chasing clients, and the people who helped you get paid as soon as you do." |
| 2:25 | End card: **PayPilot**, repo URL, live demo URL. | "It's open source, and you can try it on the PayPal sandbox today." |

---

## If you're running long

Cut in this order:

1. The edit before approving. Just click **Approve & send**.
2. The Activity shot (1:38). End section 2 on the Cash flow payouts.

(The Copilot question that used to sit at 1:00 is already cut from this version.)

## Facts used in the script (all from the demo seed)

| Item | Value |
|---|---|
| Brightline Studio | $350, usually pays within a day, gentle reminder auto-sent |
| Acme Corp | $1,800, paid 4 of 5 invoices late, ignored 2 reminders, queued for approval |
| Acme split | Maya Chen (designer) 30% = $540, Leo Park (copywriter) 20% = $360 |
| Queue after the run | Orbit Coffee, Acme Corp, Kestrel Labs |
| PayPal APIs | Invoicing v2 (create, send, remind, update note, get, record payment), Payouts v1, Webhooks with signature verification, Agent Toolkit (read-only) |
