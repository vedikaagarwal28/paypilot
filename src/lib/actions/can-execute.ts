import type { ActionStatus } from '@/lib/types';

export const PAID_STATUSES = ['PAID', 'MARKED_AS_PAID'];

const RECENT_REMINDER_MS = 10 * 60 * 1000;
const STALE_EXECUTING_MS = 2 * 60 * 1000;

export function canExecute(
  a: { status: ActionStatus | string; type?: string },
  invoiceStatus: string,
  opts: { lastReminderAt?: Date | null; now?: Date } = {},
): { ok: true } | { ok: false; reason: string } {
  if (a.status !== 'queued' && a.status !== 'executing') return { ok: false, reason: 'Already sent' };
  if (PAID_STATUSES.includes(invoiceStatus)) return { ok: false, reason: 'Invoice already paid' };
  if (invoiceStatus === 'CANCELLED') return { ok: false, reason: 'Invoice was cancelled' };
  if (a.type === 'send_invoice' && invoiceStatus !== 'DRAFT') return { ok: false, reason: 'Invoice already sent' };
  // Guards against two overlapping agent runs reminding the same client twice.
  if (a.type === 'send_reminder' && opts.lastReminderAt && opts.now && opts.now.getTime() - opts.lastReminderAt.getTime() < RECENT_REMINDER_MS) {
    return { ok: false, reason: 'A reminder was sent moments ago' };
  }
  return { ok: true };
}

/** An action left in "executing" (crash, restart, hung request) is recovered as failed after 2 minutes. */
export function isStaleExecuting(a: { status: string; decidedAt: Date | null }, now: Date): boolean {
  return a.status === 'executing' && a.decidedAt !== null && now.getTime() - a.decidedAt.getTime() > STALE_EXECUTING_MS;
}
