import { getDb } from '@/lib/db/client';
import { activity } from '@/lib/db/schema';
import type { Actor } from '@/lib/types';

export async function logActivity(e: {
  actor: Actor;
  action: string;
  summary: string;
  reason?: string;
  invoiceId?: number;
  payload?: unknown;
}): Promise<void> {
  await getDb().insert(activity).values({
    actor: e.actor,
    action: e.action,
    summary: e.summary,
    reason: e.reason ?? null,
    invoiceId: e.invoiceId ?? null,
    payload: e.payload ?? null,
  });
}
