const DAY_MS = 86_400_000;

function offsetDays(): number {
  const n = Number.parseInt(process.env.DEMO_CLOCK_OFFSET_DAYS ?? '0', 10);
  return Number.isFinite(n) ? n : 0;
}

/** "Now" for all business logic: real time shifted by DEMO_CLOCK_OFFSET_DAYS. */
export function demoNow(): Date {
  return new Date(Date.now() + offsetDays() * DAY_MS);
}

export function demoOffsetDays(): number {
  return offsetDays();
}

export function addDays(d: Date, n: number): Date {
  return new Date(d.getTime() + n * DAY_MS);
}

export function isoDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

/** Whole days from `from` to `to`, floored. */
export function daysBetween(from: Date, to: Date): number {
  return Math.floor((to.getTime() - from.getTime()) / DAY_MS);
}
