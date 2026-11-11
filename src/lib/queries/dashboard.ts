import { desc, eq, inArray, isNotNull } from 'drizzle-orm';
import { daysBetween, demoNow, demoOffsetDays } from '@/lib/clock';
import { getDb } from '@/lib/db/client';
import { activity, agentRuns, clients, invoices, pendingActions } from '@/lib/db/schema';
import { getSettings } from '@/lib/settings/store';
import type { TriageSummary } from '@/lib/types';

export type QueueItem = {
  actionId: number;
  type: string;
  status: string;
  clientName: string;
  clientId: number;
  invoiceNumber: string;
  amountCents: number;
  daysOverdue: number;
  riskScore: number | null;
  tone: string | null;
  subject: string | null;
  body: string | null;
  reason: string;
  gateReason: string;
  usedFallback: boolean;
  error: string | null;
};

export type ActivityItem = { id: number; at: string; actor: string; action: string; summary: string; reason: string | null; invoiceId: number | null };

export type Dashboard = {
  lastRun: (TriageSummary & { finishedAt: string }) | null;
  queue: QueueItem[];
  recent: ActivityItem[];
  lastResetAt: string | null;
  demoClockOffsetDays: number;
};

export function toActivityItem(a: typeof activity.$inferSelect): ActivityItem {
  return { id: a.id, at: a.at.toISOString(), actor: a.actor, action: a.action, summary: a.summary, reason: a.reason, invoiceId: a.invoiceId };
}

export async function getDashboard(): Promise<Dashboard> {
  const db = getDb();
  const now = demoNow();
  const [run] = await db.select().from(agentRuns).where(isNotNull(agentRuns.finishedAt)).orderBy(desc(agentRuns.startedAt)).limit(1);
  const queue = await db
    .select({ action: pendingActions, invoice: invoices, client: clients })
    .from(pendingActions)
    .innerJoin(invoices, eq(pendingActions.invoiceId, invoices.id))
    .innerJoin(clients, eq(invoices.clientId, clients.id))
    .where(inArray(pendingActions.status, ['queued', 'executing', 'failed']))
    .orderBy(desc(invoices.riskScore), desc(pendingActions.createdAt));
  const recent = await db.select().from(activity).orderBy(desc(activity.at), desc(activity.id)).limit(10);
  const { lastResetAt } = await getSettings();

  return {
    lastRun: run?.summary && run.finishedAt ? { ...(run.summary as TriageSummary), finishedAt: run.finishedAt.toISOString() } : null,
    queue: queue.map(({ action, invoice, client }) => ({
      actionId: action.id,
      type: action.type,
      status: action.status,
      clientName: client.name,
      clientId: client.id,
      invoiceNumber: invoice.number,
      amountCents: invoice.amountCents,
      daysOverdue: daysBetween(new Date(`${invoice.dueDate}T00:00:00Z`), now),
      riskScore: invoice.riskScore,
      tone: action.tone,
      subject: action.subject,
      body: action.body,
      reason: action.reason,
      gateReason: action.gateReason,
      usedFallback: action.usedFallback,
      error: action.error,
    })),
    recent: recent.map(toActivityItem),
    lastResetAt: lastResetAt?.toISOString() ?? null,
    demoClockOffsetDays: demoOffsetDays(),
  };
}
