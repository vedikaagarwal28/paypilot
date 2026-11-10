import { expect, test } from 'vitest';
import { decide } from '@/lib/policy/gate';
import { DEFAULT_RULES as R } from '@/lib/types';

test('gentle small low-risk auto-sends', () => expect(decide({ type: 'send_reminder', amountCents: 35000, riskScore: 7, tone: 'gentle' }, R))
  .toEqual({ auto: true, reason: 'Sent automatically under your rules: gentle tone, $350.00 ≤ $500.00, risk 7 < 40' }));

test('amount over limit queues', () => expect(decide({ type: 'send_reminder', amountCents: 65000, riskScore: 28, tone: 'gentle' }, R))
  .toEqual({ auto: false, reason: 'Needs your approval: $650.00 is over your $500.00 auto-send limit' }));

test('non-auto tone queues', () => expect(decide({ type: 'send_reminder', amountCents: 180000, riskScore: 65, tone: 'friendly_firm' }, R))
  .toEqual({ auto: false, reason: 'Needs your approval: friendly-firm reminders always need you' }));

test('high risk queues', () => expect(decide({ type: 'send_reminder', amountCents: 10000, riskScore: 45, tone: 'gentle' }, R).reason)
  .toBe('Needs your approval: risk 45 is at or above your auto-send limit of 40'));

test('invoice send queues by default', () => expect(decide({ type: 'send_invoice', amountCents: 120000, riskScore: 0, tone: null }, R))
  .toEqual({ auto: false, reason: 'Needs your approval: sending new invoices always needs you' }));

test('raised limit auto-sends Orbit', () => expect(
  decide({ type: 'send_reminder', amountCents: 65000, riskScore: 28, tone: 'gentle' }, { ...R, autoSendMaxAmountCents: 100000 }).auto,
).toBe(true));
