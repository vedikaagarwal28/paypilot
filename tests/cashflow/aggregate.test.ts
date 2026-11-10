import { expect, test } from 'vitest';
import { aggregateCashflow } from '@/lib/cashflow/aggregate';

test('aggregateCashflow fixture', () => {
  const now = new Date('2026-11-11T12:00:00Z');
  const r = aggregateCashflow([
    { amountCents: 120000, dueDate: '2026-11-01', status: 'PAID', paidAt: new Date('2026-11-06T10:00:00Z'), riskScore: 10 },
    { amountCents: 180000, dueDate: '2026-11-20', status: 'SENT', paidAt: null, riskScore: 65 },
    { amountCents: 240000, dueDate: '2026-11-25', status: 'SENT', paidAt: null, riskScore: 98 },
    { amountCents: 35000, dueDate: '2026-11-08', status: 'UNPAID', paidAt: null, riskScore: 7 },
  ], [
    { amountCents: 54000, status: 'SUCCESS', createdAt: now },
    { amountCents: 1000, status: 'FAILED', createdAt: now },
  ], now);
  expect(r.receivedThisMonthCents).toBe(120000);
  expect(r.expectedNext30Cents).toBe(455000);
  expect(r.atRiskCents).toBe(240000);
  expect(r.paidOutCents).toBe(54000);
  expect(r.weekly).toHaveLength(8);
  expect(r.weekly.find((w) => w.weekStart === '2026-11-09')?.expectedCents).toBe(35000);
  expect(r.weekly.find((w) => w.weekStart === '2026-11-02')?.receivedCents).toBe(120000);
});
