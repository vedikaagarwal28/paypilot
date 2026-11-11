import { eq } from 'drizzle-orm';
import { logActivity } from '@/lib/activity/log';
import { PAID_STATUSES } from '@/lib/actions/can-execute';
import { getDb } from '@/lib/db/client';
import { invoices, splits } from '@/lib/db/schema';
import { splitsSchema } from '@/lib/settings/schema';

export const dynamic = 'force-dynamic';

export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const id = Number((await params).id);
  const parsed = splitsSchema.safeParse((await req.json().catch(() => ({}))).splits);
  if (!Number.isInteger(id)) return Response.json({ error: 'Bad request' }, { status: 400 });
  if (!parsed.success) return Response.json({ error: parsed.error.issues[0].message }, { status: 400 });

  const db = getDb();
  const [inv] = await db.select().from(invoices).where(eq(invoices.id, id));
  if (!inv) return Response.json({ error: 'Invoice not found' }, { status: 404 });
  if (PAID_STATUSES.includes(inv.status)) return Response.json({ error: 'Invoice already paid — splits are locked' }, { status: 409 });

  await db.delete(splits).where(eq(splits.invoiceId, id));
  if (parsed.data.length) await db.insert(splits).values(parsed.data.map((s) => ({ ...s, invoiceId: id })));
  await logActivity({
    actor: 'user',
    action: 'splits_updated',
    summary: `Updated split on ${inv.number}`,
    reason: parsed.data.length ? parsed.data.map((s) => `${s.percent}%`).join(' / ') : 'No split',
    invoiceId: id,
  });
  return Response.json({ splits: parsed.data });
}
