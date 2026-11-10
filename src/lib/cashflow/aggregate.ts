import { PAID_STATUSES } from '@/lib/actions/can-execute';
import { addDays, isoDate } from '@/lib/clock';

export interface Cashflow {
  receivedThisMonthCents: number;
  expectedNext30Cents: number;
  atRiskCents: number;
  paidOutCents: number;
  weekly: { weekStart: string; receivedCents: number; expectedCents: number }[];
}

const CLOSED = [...PAID_STATUSES, 'CANCELLED', 'DRAFT'];

function mondayOf(d: Date): Date {
  const day = d.getUTCDay();
  const monday = addDays(d, -((day + 6) % 7));
  return new Date(`${isoDate(monday)}T00:00:00Z`);
}

export function aggregateCashflow(
  invoices: { amountCents: number; dueDate: string; status: string; paidAt: Date | null; riskScore: number | null }[],
  payouts: { amountCents: number; status: string; createdAt: Date }[],
  now: Date,
): Cashflow {
  const paid = invoices.filter((i) => PAID_STATUSES.includes(i.status) && i.paidAt);
  const open = invoices.filter((i) => !CLOSED.includes(i.status));
  const horizon = isoDate(addDays(now, 30));
  const thisMonth = now.toISOString().slice(0, 7);

  const currentWeek = mondayOf(now);
  const weekly = Array.from({ length: 8 }, (_, k) => ({
    weekStart: isoDate(addDays(currentWeek, (k - 4) * 7)),
    receivedCents: 0,
    expectedCents: 0,
  }));
  const bucket = (date: Date) => weekly.find((w) => w.weekStart === isoDate(mondayOf(date)));

  for (const i of paid) {
    const w = bucket(i.paidAt!);
    if (w) w.receivedCents += i.amountCents;
  }
  for (const i of open) {
    const due = new Date(`${i.dueDate}T00:00:00Z`);
    // Overdue money is still expected; it lands in the current week.
    const w = bucket(due < currentWeek ? now : due);
    if (w) w.expectedCents += i.amountCents;
  }

  return {
    receivedThisMonthCents: paid.filter((i) => i.paidAt!.toISOString().startsWith(thisMonth)).reduce((s, i) => s + i.amountCents, 0),
    expectedNext30Cents: open.filter((i) => i.dueDate <= horizon).reduce((s, i) => s + i.amountCents, 0),
    atRiskCents: open.filter((i) => (i.riskScore ?? 0) >= 70).reduce((s, i) => s + i.amountCents, 0),
    paidOutCents: payouts.filter((p) => p.status === 'SUCCESS').reduce((s, p) => s + p.amountCents, 0),
    weekly,
  };
}
