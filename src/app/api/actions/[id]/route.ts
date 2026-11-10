import { z } from 'zod';
import { executeAction, retryAction, skipAction } from '@/lib/actions/execute';
import { getDb } from '@/lib/db/client';
import { pendingActions } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';

export const dynamic = 'force-dynamic';

const Body = z.object({
  op: z.enum(['approve', 'skip', 'retry']),
  subject: z.string().max(200).optional(),
  body: z.string().max(4000).optional(),
});

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const id = Number((await params).id);
  const parsed = Body.safeParse(await req.json().catch(() => ({})));
  if (!Number.isInteger(id) || !parsed.success) return Response.json({ error: 'Bad request' }, { status: 400 });
  const { op, subject, body } = parsed.data;
  if (op === 'approve') return Response.json({ status: await executeAction(id, 'user', { subject, body }) });
  if (op === 'skip') await skipAction(id);
  else await retryAction(id);
  const [row] = await getDb().select({ status: pendingActions.status }).from(pendingActions).where(eq(pendingActions.id, id));
  return Response.json({ status: row?.status ?? null });
}
