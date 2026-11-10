import type { ActionStatus } from '@/lib/types';

export const PAID_STATUSES = ['PAID', 'MARKED_AS_PAID'];

export function canExecute(a: { status: ActionStatus | string }, invoiceStatus: string): { ok: true } | { ok: false; reason: string } {
  if (a.status !== 'queued' && a.status !== 'executing') return { ok: false, reason: 'Already sent' };
  if (PAID_STATUSES.includes(invoiceStatus)) return { ok: false, reason: 'Invoice already paid' };
  if (invoiceStatus === 'CANCELLED') return { ok: false, reason: 'Invoice was cancelled' };
  return { ok: true };
}
