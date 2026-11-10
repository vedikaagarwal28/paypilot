import { expect, test } from 'vitest';
import { canExecute } from '@/lib/actions/can-execute';

test('canExecute', () => {
  expect(canExecute({ status: 'queued' }, 'SENT')).toEqual({ ok: true });
  expect(canExecute({ status: 'executing' }, 'UNPAID')).toEqual({ ok: true });
  expect(canExecute({ status: 'queued' }, 'PAID')).toEqual({ ok: false, reason: 'Invoice already paid' });
  expect(canExecute({ status: 'queued' }, 'MARKED_AS_PAID')).toEqual({ ok: false, reason: 'Invoice already paid' });
  expect(canExecute({ status: 'queued' }, 'CANCELLED')).toEqual({ ok: false, reason: 'Invoice was cancelled' });
  expect(canExecute({ status: 'sent' }, 'SENT')).toEqual({ ok: false, reason: 'Already sent' });
});
