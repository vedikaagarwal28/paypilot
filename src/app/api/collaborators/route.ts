import { asc, eq } from 'drizzle-orm';
import { z } from 'zod';
import { getDb } from '@/lib/db/client';
import { collaborators } from '@/lib/db/schema';
import { collaboratorSchema } from '@/lib/settings/schema';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    return Response.json(await getDb().select().from(collaborators).orderBy(asc(collaborators.id)));
  } catch (e) {
    return Response.json({ error: e instanceof Error ? e.message : String(e) }, { status: 500 });
  }
}

export async function POST(req: Request) {
  const parsed = collaboratorSchema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return Response.json({ error: parsed.error.issues[0].message }, { status: 400 });
  const [row] = await getDb().insert(collaborators).values(parsed.data).returning();
  return Response.json(row);
}

export async function PUT(req: Request) {
  const parsed = collaboratorSchema.extend({ id: z.number().int().positive() }).safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return Response.json({ error: parsed.error.issues[0].message }, { status: 400 });
  const { id, ...values } = parsed.data;
  const [row] = await getDb().update(collaborators).set(values).where(eq(collaborators.id, id)).returning();
  return row ? Response.json(row) : Response.json({ error: 'Collaborator not found' }, { status: 404 });
}
