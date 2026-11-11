import { expect, test } from 'vitest';
import { canExecute, isStaleExecuting } from '@/lib/actions/can-execute';

test('canExecute', () => {
  expect(canExecute({ status: 'queued' }, 'SENT')).toEqual({ ok: true });
  expect(canExecute({ status: 'executing' }, 'UNPAID')).toEqual({ ok: true });
  expect(canExecute({ status: 'queued' }, 'PAID')).toEqual({ ok: false, reason: 'Invoice already paid' });
  expect(canExecute({ status: 'queued' }, 'MARKED_AS_PAID')).toEqual({ ok: false, reason: 'Invoice already paid' });
  expect(canExecute({ status: 'queued' }, 'CANCELLED')).toEqual({ ok: false, reason: 'Invoice was cancelled' });
  expect(canExecute({ status: 'sent' }, 'SENT')).toEqual({ ok: false, reason: 'Already sent' });
});

test('send_invoice is only valid while the PayPal invoice is still a draft', () => {
  expect(canExecute({ status: 'executing', type: 'send_invoice' }, 'DRAFT')).toEqual({ ok: true });
  expect(canExecute({ status: 'executing', type: 'send_invoice' }, 'SENT')).toEqual({ ok: false, reason: 'Invoice already sent' });
});

test('a reminder sent moments ago blocks a second one', () => {
  const now = new Date('2026-11-11T12:00:00Z');
  expect(canExecute({ status: 'executing', type: 'send_reminder' }, 'SENT', { lastReminderAt: new Date('2026-11-11T11:58:00Z'), now }))
    .toEqual({ ok: false, reason: 'A reminder was sent moments ago' });
  expect(canExecute({ status: 'executing', type: 'send_reminder' }, 'SENT', { lastReminderAt: new Date('2026-11-11T11:40:00Z'), now }))
    .toEqual({ ok: true });
});

test('executing actions older than 2 minutes are stale', () => {
  const now = new Date('2026-11-11T12:00:00Z');
  expect(isStaleExecuting({ status: 'executing', decidedAt: new Date('2026-11-11T11:57:00Z') }, now)).toBe(true);
  expect(isStaleExecuting({ status: 'executing', decidedAt: new Date('2026-11-11T11:59:30Z') }, now)).toBe(false);
  expect(isStaleExecuting({ status: 'queued', decidedAt: null }, now)).toBe(false);
});
