import { expect, test } from 'vitest';
import { computeSplits, planPayouts, SplitError } from '@/lib/splits/compute';

test('splits 30/20 of 1800', () => expect(computeSplits(180000, [{ collaboratorId: 1, percent: 30 }, { collaboratorId: 2, percent: 20 }]))
  .toEqual([{ collaboratorId: 1, amountCents: 54000 }, { collaboratorId: 2, amountCents: 36000 }]));

test('floors odd cents', () => expect(computeSplits(100001, [{ collaboratorId: 1, percent: 33 }])[0].amountCents).toBe(33000));

test('rejects >100%', () => expect(() => computeSplits(1000, [{ collaboratorId: 1, percent: 60 }, { collaboratorId: 2, percent: 50 }])).toThrow(SplitError));

test('rejects 0%', () => expect(() => computeSplits(1000, [{ collaboratorId: 1, percent: 0 }])).toThrow(SplitError));

test('planPayouts skips already-paid collaborators', () => expect(planPayouts(
  { paypalId: 'INV2-A', amountCents: 180000 },
  [{ collaboratorId: 1, percent: 30 }, { collaboratorId: 2, percent: 20 }],
  [{ collaboratorId: 1 }, { collaboratorId: 2 }],
)).toEqual([]));

test('planPayouts ids', () => expect(planPayouts({ paypalId: 'INV2-A', amountCents: 180000 }, [{ collaboratorId: 1, percent: 30 }], [])[0])
  .toEqual({ collaboratorId: 1, amountCents: 54000, senderItemId: 'INV2-A-1' }));
