import { expect, test } from 'vitest';
import { featuresFor, scoreRisk, toneForScore } from '@/lib/risk/score';
import { addDays, daysBetween, isoDate } from '@/lib/clock';

const brightline = { daysOverdue: 3, avgDaysLate: 1, pctPaidLate: 0.1, ignoredReminders: 0, amountRatio: 0.8, remindersOnInvoice: 0 };
const orbit = { daysOverdue: 8, avgDaysLate: 6, pctPaidLate: 0.4, ignoredReminders: 1, amountRatio: 1.0, remindersOnInvoice: 0 };
const acme = { daysOverdue: 20, avgDaysLate: 15, pctPaidLate: 0.8, ignoredReminders: 2, amountRatio: 1.0, remindersOnInvoice: 0 };
const kestrel = { daysOverdue: 30, avgDaysLate: 20, pctPaidLate: 1.0, ignoredReminders: 3, amountRatio: 2.0, remindersOnInvoice: 1 };

test('seed scores', () => {
  expect(scoreRisk(brightline)).toMatchObject({ score: 7, tone: 'gentle' });
  expect(scoreRisk(orbit)).toMatchObject({ score: 28, tone: 'gentle' });
  expect(scoreRisk(acme)).toMatchObject({ score: 65, tone: 'friendly_firm' });
  expect(scoreRisk(kestrel)).toMatchObject({ score: 98, tone: 'firm' });
});

test('tone bands', () => {
  expect([39, 40, 69, 70].map(toneForScore)).toEqual(['gentle', 'friendly_firm', 'friendly_firm', 'firm']);
});

test('not yet due adds no overdue points', () => {
  expect(scoreRisk({ ...brightline, daysOverdue: -10 }).factors.find((f) => f.label.startsWith('Overdue'))).toBeUndefined();
});

test('factors sorted desc, zero-point factors omitted', () => {
  const f = scoreRisk(kestrel).factors;
  expect(f.map((x) => x.points)).toEqual([...f.map((x) => x.points)].sort((a, b) => b - a));
  expect(f.every((x) => x.points > 0)).toBe(true);
  expect(f[0]).toEqual({ label: 'Overdue 30 days', points: 35 });
});

test('featuresFor computes daysOverdue from demo now', () => {
  expect(featuresFor(
    { amountCents: 35000, dueDate: '2026-11-08', remindersSent: 0 },
    { avgDaysLate: 1, pctPaidLate: 0.1, ignoredReminders: 0, typicalAmountCents: 43750 },
    new Date('2026-11-11T12:00:00Z'),
  )).toMatchObject({ daysOverdue: 3, amountRatio: 0.8 });
});

test('clock helpers', () => {
  const now = new Date('2026-11-11T12:00:00Z');
  expect(isoDate(addDays(now, -3))).toBe('2026-11-08');
  expect(daysBetween(new Date('2026-11-08'), now)).toBe(3);
});
