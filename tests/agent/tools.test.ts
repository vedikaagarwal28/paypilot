import { expect, test } from 'vitest';
import { parseSplitInput, resolveClient } from '@/lib/agent/resolve';

const cs = [{ id: 1, name: 'Acme Corp' }, { id: 2, name: 'Juniper & Co' }, { id: 3, name: 'Orbit Coffee' }];
const collabs = [{ id: 1, name: 'Maya Chen' }, { id: 2, name: 'Leo Park' }];

test('resolveClient exact-ish', () => expect(resolveClient('acme', cs)).toMatchObject({ ok: true, client: { id: 1 } }));

test('resolveClient prefers exact name over substring', () => expect(resolveClient('Orbit Coffee', cs)).toMatchObject({ ok: true, client: { id: 3 } }));

test('resolveClient ambiguous', () => expect(resolveClient('co', cs))
  .toEqual({ ok: false, error: '"co" matches several clients: Acme Corp, Juniper & Co, Orbit Coffee. Which one?' }));

test('resolveClient none', () => expect(resolveClient('zeta', cs))
  .toEqual({ ok: false, error: 'No client matches "zeta". Clients: Acme Corp, Juniper & Co, Orbit Coffee' }));

test('parseSplitInput rejects >100', () => expect(parseSplitInput(
  [{ collaboratorName: 'maya', percent: 70 }, { collaboratorName: 'leo', percent: 40 }], collabs,
)).toEqual({ ok: false, error: 'Splits add up to more than 100%' }));

test('parseSplitInput resolves names', () => expect(parseSplitInput([{ collaboratorName: 'maya', percent: 30 }], collabs))
  .toEqual({ ok: true, splits: [{ collaboratorId: 1, percent: 30 }] }));

test('parseSplitInput unknown collaborator', () => expect(parseSplitInput([{ collaboratorName: 'zed', percent: 10 }], collabs).ok).toBe(false));
