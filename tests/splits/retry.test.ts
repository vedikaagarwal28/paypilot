import { expect, test } from 'vitest';
import { retryBatchId } from '@/lib/splits/compute';

test('payout retries use a fresh sender batch id so PayPal does not reject them as duplicates', () => {
  expect(retryBatchId('paid-INV2-A', 2)).toBe('paid-INV2-A-retry-2');
  expect(retryBatchId('paid-INV2-A-retry-2', 3)).toBe('paid-INV2-A-retry-3');
});
