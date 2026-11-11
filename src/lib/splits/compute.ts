export class SplitError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'SplitError';
  }
}

type Split = { collaboratorId: number; percent: number };

/** Floors each share; the remainder stays with the invoice owner. */
export function computeSplits(totalCents: number, s: Split[]): { collaboratorId: number; amountCents: number }[] {
  if (s.some((x) => x.percent <= 0)) throw new SplitError('Each split must be more than 0%');
  if (s.reduce((sum, x) => sum + x.percent, 0) > 100) throw new SplitError('Splits add up to more than 100%');
  return s.map((x) => ({ collaboratorId: x.collaboratorId, amountCents: Math.floor((totalCents * x.percent) / 100) }));
}

/** PayPal rejects a reused sender_batch_id, so each payout retry gets its own. */
export function retryBatchId(senderBatchId: string, attempt: number): string {
  return `${senderBatchId.replace(/-retry-\d+$/, '')}-retry-${attempt}`;
}

/** Payouts still owed for a paid invoice; collaborators already in `existing` are never paid twice. */
export function planPayouts(
  inv: { paypalId: string; amountCents: number },
  s: Split[],
  existing: { collaboratorId: number }[],
): { collaboratorId: number; amountCents: number; senderItemId: string }[] {
  const done = new Set(existing.map((e) => e.collaboratorId));
  return computeSplits(inv.amountCents, s)
    .filter((p) => !done.has(p.collaboratorId) && p.amountCents > 0)
    .map((p) => ({ ...p, senderItemId: `${inv.paypalId}-${p.collaboratorId}` }));
}
