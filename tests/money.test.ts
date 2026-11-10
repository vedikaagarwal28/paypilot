import { expect, test } from 'vitest';
import { centsToString, formatUsd, toCents } from '@/lib/money';

test('centsToString formats PayPal amount strings', () => {
  expect(centsToString(180000)).toBe('1800.00');
  expect(centsToString(5)).toBe('0.05');
});

test('toCents parses PayPal amount strings', () => {
  expect(toCents('540.00')).toBe(54000);
  expect(toCents('0.1')).toBe(10);
});

test('formatUsd renders dollars with separators', () => {
  expect(formatUsd(180000)).toBe('$1,800.00');
});
