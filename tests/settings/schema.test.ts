import { expect, test } from 'vitest';
import { collaboratorSchema, rulesSchema, splitsSchema } from '@/lib/settings/schema';
import { DEFAULT_RULES } from '@/lib/types';

test('rules reject negative amount', () => expect(rulesSchema.safeParse({ ...DEFAULT_RULES, autoSendMaxAmountCents: -1 }).success).toBe(false));

test('rules reject risk 101', () => expect(rulesSchema.safeParse({ ...DEFAULT_RULES, autoSendMaxRisk: 101 }).success).toBe(false));

test('rules reject unknown tone', () => expect(rulesSchema.safeParse({ ...DEFAULT_RULES, autoSendTones: ['rude'] }).success).toBe(false));

test('defaults valid', () => expect(rulesSchema.safeParse(DEFAULT_RULES).success).toBe(true));

test('splits >100 rejected with message', () => {
  const r = splitsSchema.safeParse([{ collaboratorId: 1, percent: 60 }, { collaboratorId: 2, percent: 50 }]);
  expect(r.success).toBe(false);
  expect(r.error!.issues[0].message).toBe('Splits add up to more than 100%');
});

test('splits reject duplicate collaborator', () => {
  const r = splitsSchema.safeParse([{ collaboratorId: 1, percent: 10 }, { collaboratorId: 1, percent: 10 }]);
  expect(r.success).toBe(false);
  expect(r.error!.issues[0].message).toBe('Each collaborator can appear only once');
});

test('empty splits allowed', () => expect(splitsSchema.safeParse([]).success).toBe(true));

test('collaborator needs a valid email', () => {
  expect(collaboratorSchema.safeParse({ name: 'Maya', role: 'Designer', paypalEmail: 'nope', defaultPercent: 30 }).success).toBe(false);
  expect(collaboratorSchema.safeParse({ name: 'Maya', role: 'Designer', paypalEmail: 'maya@x.com', defaultPercent: 30 }).success).toBe(true);
});
