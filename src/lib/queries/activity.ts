import { and, desc, eq, type SQL } from 'drizzle-orm';
import { getDb } from '@/lib/db/client';
import { activity } from '@/lib/db/schema';
import { toActivityItem, type ActivityItem } from './dashboard';

export async function getActivity(opts: { actor?: string; invoiceId?: number; limit?: number } = {}): Promise<ActivityItem[]> {
  const where: SQL[] = [];
  if (opts.actor) where.push(eq(activity.actor, opts.actor));
  if (opts.invoiceId) where.push(eq(activity.invoiceId, opts.invoiceId));
  const rows = await getDb()
    .select()
    .from(activity)
    .where(where.length ? and(...where) : undefined)
    .orderBy(desc(activity.at), desc(activity.id))
    .limit(opts.limit ?? 100);
  return rows.map(toActivityItem);
}
