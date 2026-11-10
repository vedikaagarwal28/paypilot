import { and, eq } from 'drizzle-orm';
import { z } from 'zod';
import { draftReminder } from '@/lib/agent/draft';
import { draftContextFor } from '@/lib/agent/triage';
import { demoNow } from '@/lib/clock';
import { getDb } from '@/lib/db/client';
import { clients, invoices, pendingActions } from '@/lib/db/schema';
import { featuresFor, scoreRisk } from '@/lib/risk/score';

export const dynamic = 'force-dynamic';

const Body = z.object({ tone: z.enum(['gentle', 'friendly_firm', 'firm']) });

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const id = Number((await params).id);
  const parsed = Body.safeParse(await req.json().catch(() => ({})));
  if (!Number.isInteger(id) || !parsed.success) return Response.json({ error: 'Bad request' }, { status: 400 });
  const db = getDb();
  const [row] = await db
    .select({ action: pendingActions, invoice: invoices, client: clients })
    .from(pendingActions)
    .innerJoin(invoices, eq(pendingActions.invoiceId, invoices.id))
    .innerJoin(clients, eq(invoices.clientId, clients.id))
    .where(and(eq(pendingActions.id, id), eq(pendingActions.status, 'queued'), eq(pendingActions.type, 'send_reminder')));
  if (!row) return Response.json({ error: 'Only queued reminders can be redrafted' }, { status: 409 });

  const risk = scoreRisk(featuresFor(row.invoice, row.client, demoNow()));
  const draft = await draftReminder(draftContextFor(row.invoice, row.client, risk, parsed.data.tone));
  await db
    .update(pendingActions)
    .set({ tone: parsed.data.tone, subject: draft.subject, body: draft.body, usedFallback: draft.usedFallback })
    .where(eq(pendingActions.id, id));
  return Response.json({ subject: draft.subject, body: draft.body, usedFallback: draft.usedFallback });
}
