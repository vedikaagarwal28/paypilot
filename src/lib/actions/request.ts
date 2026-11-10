import { eq } from 'drizzle-orm';
import { logActivity } from '@/lib/activity/log';
import { getDb } from '@/lib/db/client';
import { clients, invoices, pendingActions } from '@/lib/db/schema';
import { decide } from '@/lib/policy/gate';
import { getSettings } from '@/lib/settings/store';
import { TONE_LABEL, type ActionStatus, type ActionType, type Tone } from '@/lib/types';
import { executeAction } from './execute';

/** Every agent-initiated send goes through here: the policy gate decides auto-run vs approval queue. */
export async function requestAction(i: {
  type: ActionType;
  invoiceId: number;
  tone: Tone | null;
  subject: string | null;
  body: string | null;
  reason: string;
  usedFallback?: boolean;
}): Promise<{ actionId: number; auto: boolean; gateReason: string; status: ActionStatus }> {
  const db = getDb();
  const [row] = await db
    .select({ invoice: invoices, client: clients })
    .from(invoices)
    .innerJoin(clients, eq(invoices.clientId, clients.id))
    .where(eq(invoices.id, i.invoiceId));
  if (!row) throw new Error(`Invoice ${i.invoiceId} not found`);
  const { rules } = await getSettings();
  const gate = decide({ type: i.type, amountCents: row.invoice.amountCents, riskScore: row.invoice.riskScore ?? 0, tone: i.tone }, rules);

  const [action] = await db
    .insert(pendingActions)
    .values({
      type: i.type,
      invoiceId: i.invoiceId,
      tone: i.tone,
      subject: i.subject,
      body: i.body,
      reason: i.reason,
      gateReason: gate.reason,
      usedFallback: i.usedFallback ?? false,
      status: 'queued',
    })
    .returning();

  await logActivity({
    actor: 'agent',
    action: i.type === 'send_reminder' ? 'reminder_drafted' : 'invoice_drafted',
    summary: i.type === 'send_reminder'
      ? `Drafted ${i.tone ? TONE_LABEL[i.tone] : ''} reminder for ${row.client.name}`
      : `Drafted invoice ${row.invoice.number} for ${row.client.name}`,
    reason: gate.reason,
    invoiceId: i.invoiceId,
  });

  const status = gate.auto ? await executeAction(action.id, 'rule') : 'queued';
  return { actionId: action.id, auto: gate.auto, gateReason: gate.reason, status };
}
