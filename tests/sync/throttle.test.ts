import { expect, test } from 'vitest';
import { shouldSync } from '@/lib/sync/throttle';

test('syncs when never synced', () => expect(shouldSync(null, 1_000_000, 10_000)).toBe(true));
test('skips inside the interval', () => expect(shouldSync(995_000, 1_000_000, 10_000)).toBe(false));
test('syncs once the interval has passed', () => expect(shouldSync(990_000, 1_000_000, 10_000)).toBe(true));
