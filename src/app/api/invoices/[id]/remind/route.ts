import { and, eq } from 'drizzle-orm';
import { PAID_STATUSES } from '@/lib/actions/can-execute';
import { requestAction } from '@/lib/actions/request';
import { draftReminder } from '@/lib/agent/draft';
import { draftContextFor } from '@/lib/agent/triage';
import { demoNow } from '@/lib/clock';
import { getDb } from '@/lib/db/client';
import { clients, invoices, pendingActions } from '@/lib/db/schema';
import { describePayPalError } from '@/lib/paypal/http';
import { featuresFor, scoreRisk } from '@/lib/risk/score';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

/** Manual "Remind" from the grid: same draft + policy gate path the agent uses. */
export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const id = Number((await params).id);
  if (!Number.isInteger(id)) return Response.json({ error: 'Bad request' }, { status: 400 });
  const db = getDb();
  const [row] = await db.select({ invoice: invoices, client: clients }).from(invoices).innerJoin(clients, eq(invoices.clientId, clients.id)).where(eq(invoices.id, id));
  if (!row) return Response.json({ error: 'Invoice not found' }, { status: 404 });
  if ([...PAID_STATUSES, 'CANCELLED', 'DRAFT'].includes(row.invoice.status)) {
    return Response.json({ error: `Invoice is ${row.invoice.status.toLowerCase().replaceAll('_', ' ')}; nothing to remind` }, { status: 409 });
  }
  const [queued] = await db.select().from(pendingActions).where(and(eq(pendingActions.invoiceId, id), eq(pendingActions.status, 'queued')));
  if (queued) return Response.json({ error: 'A reminder for this invoice is already waiting on the Today page' }, { status: 409 });

  try {
    const risk = scoreRisk(featuresFor(row.invoice, row.client, demoNow()));
    await db.update(invoices).set({ riskScore: risk.score, riskTone: risk.tone, riskFactors: risk.factors }).where(eq(invoices.id, id));
    const draft = await draftReminder(draftContextFor(row.invoice, row.client, risk));
    const res = await requestAction({
      type: 'send_reminder', invoiceId: id, tone: risk.tone, subject: draft.subject, body: draft.body, reason: draft.explanation, usedFallback: draft.usedFallback,
    });
    return Response.json({ status: res.status, gateReason: res.gateReason });
  } catch (e) {
    return Response.json({ error: describePayPalError(e) }, { status: 500 });
  }
}
