import { desc, eq, inArray } from 'drizzle-orm';
import { getDb } from '@/lib/db/client';
import { activity, clients } from '@/lib/db/schema';
import { toActivityItem, type ActivityItem } from './dashboard';
import { getInvoiceRows, type InvoiceRow } from './invoices';

export async function getClient(id: number): Promise<{ client: typeof clients.$inferSelect; invoices: InvoiceRow[]; activity: ActivityItem[] } | null> {
  const db = getDb();
  const [client] = await db.select().from(clients).where(eq(clients.id, id));
  if (!client) return null;
  const invoices = await getInvoiceRows({ clientId: id });
  const ids = invoices.map((i) => i.id);
  const acts = ids.length
    ? await db.select().from(activity).where(inArray(activity.invoiceId, ids)).orderBy(desc(activity.at), desc(activity.id)).limit(50)
    : [];
  return { client, invoices, activity: acts.map(toActivityItem) };
}
