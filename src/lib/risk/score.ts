import { daysBetween } from '@/lib/clock';
import type { RiskFactor, RiskFeatures, RiskResult, Tone } from '@/lib/types';

const round1 = (n: number) => Math.round(n * 10) / 10;
const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? '' : 's'}`;

export function toneForScore(score: number): Tone {
  if (score >= 70) return 'firm';
  if (score >= 40) return 'friendly_firm';
  return 'gentle';
}

export function scoreRisk(f: RiskFeatures): RiskResult {
  const raw: RiskFactor[] = [
    { label: `Overdue ${plural(f.daysOverdue, 'day')}`, points: (Math.min(Math.max(f.daysOverdue, 0), 30) / 30) * 35 },
    { label: `Pays ${plural(f.avgDaysLate, 'day')} late on average`, points: (Math.min(f.avgDaysLate, 20) / 20) * 25 },
    { label: `${Math.round(f.pctPaidLate * 100)}% of invoices paid late`, points: f.pctPaidLate * 20 },
    { label: `Ignored ${plural(f.ignoredReminders, 'reminder')}`, points: (Math.min(f.ignoredReminders, 3) / 3) * 10 },
    { label: `Amount ${round1(f.amountRatio)}× their usual`, points: Math.min(Math.max(f.amountRatio - 1, 0), 1) * 5 },
    { label: `${plural(f.remindersOnInvoice, 'reminder')} already sent`, points: (Math.min(f.remindersOnInvoice, 2) / 2) * 5 },
  ];
  const score = Math.round(raw.reduce((s, x) => s + x.points, 0));
  const factors = raw
    .filter((x) => x.points > 0)
    .map((x) => ({ label: x.label, points: round1(x.points) }))
    .sort((a, b) => b.points - a.points);
  return { score, tone: toneForScore(score), factors };
}

export function featuresFor(
  inv: { amountCents: number; dueDate: string; remindersSent: number },
  c: { avgDaysLate: number; pctPaidLate: number; ignoredReminders: number; typicalAmountCents: number },
  now: Date,
): RiskFeatures {
  return {
    daysOverdue: daysBetween(new Date(`${inv.dueDate}T00:00:00Z`), now),
    avgDaysLate: c.avgDaysLate,
    pctPaidLate: c.pctPaidLate,
    ignoredReminders: c.ignoredReminders,
    amountRatio: c.typicalAmountCents > 0 ? inv.amountCents / c.typicalAmountCents : 1,
    remindersOnInvoice: inv.remindersSent,
  };
}
