import { expect, test } from 'vitest';
import { batchId } from '@/lib/demo/batch';

test('batch ids include seconds plus a random suffix', () => {
  const d = new Date('2026-11-11T12:34:56Z');
  expect(batchId(d)).toMatch(/^PP261111123456[a-z0-9]{3}$/);
});

test('two resets in the same second get different batch ids', () => {
  const d = new Date('2026-11-11T12:34:56Z');
  const ids = new Set(Array.from({ length: 20 }, () => batchId(d)));
  expect(ids.size).toBeGreaterThan(1);
});
