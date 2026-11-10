import { expect, test } from 'vitest';
import { SEED_CLIENTS, SEED_COLLABORATORS, SEED_INVOICES } from '@/lib/demo/seed-data';
import { featuresFor, scoreRisk } from '@/lib/risk/score';
import { decide } from '@/lib/policy/gate';
import { addDays, isoDate } from '@/lib/clock';
import { DEFAULT_RULES } from '@/lib/types';

test('seed produces the scripted demo', () => {
  const now = new Date('2026-11-11T12:00:00Z');
  const results = SEED_INVOICES.filter((i) => !i.paid).map((i) => {
    const c = SEED_CLIENTS[i.clientIndex];
    const r = scoreRisk(featuresFor({ amountCents: i.amountCents, dueDate: isoDate(addDays(now, i.dueInDays)), remindersSent: i.remindersSent }, c, now));
    return {
      client: c.name,
      score: r.score,
      tone: r.tone,
      auto: decide({ type: 'send_reminder', amountCents: i.amountCents, riskScore: r.score, tone: r.tone }, DEFAULT_RULES).auto,
      overdue: i.dueInDays < 0,
    };
  });
  expect(results).toEqual([
    { client: 'Brightline Studio', score: 7, tone: 'gentle', auto: true, overdue: true },
    { client: 'Orbit Coffee', score: 28, tone: 'gentle', auto: false, overdue: true },
    { client: 'Acme Corp', score: 65, tone: 'friendly_firm', auto: false, overdue: true },
    { client: 'Kestrel Labs', score: 98, tone: 'firm', auto: false, overdue: true },
    { client: 'Juniper & Co', score: expect.any(Number), tone: 'gentle', auto: expect.any(Boolean), overdue: false },
  ]);
});

test('seed splits reference real collaborators and stay under 100%', () => {
  for (const inv of SEED_INVOICES) {
    const total = inv.splits.reduce((s, x) => s + x.percent, 0);
    expect(total).toBeLessThanOrEqual(100);
    for (const s of inv.splits) expect(SEED_COLLABORATORS[s.collaboratorIndex]).toBeDefined();
  }
  expect(SEED_INVOICES.find((i) => i.description.startsWith('Website redesign'))!.splits.map((s) => s.percent)).toEqual([30, 20]);
});
