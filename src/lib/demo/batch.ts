const pad = (n: number) => String(n).padStart(2, '0');

/** Unique per reset (seconds + random suffix) so a retried reset never collides on invoice numbers. */
export function batchId(d: Date): string {
  const stamp = `${String(d.getUTCFullYear()).slice(2)}${pad(d.getUTCMonth() + 1)}${pad(d.getUTCDate())}${pad(d.getUTCHours())}${pad(d.getUTCMinutes())}${pad(d.getUTCSeconds())}`;
  return `PP${stamp}${Math.random().toString(36).slice(2, 5).padEnd(3, '0')}`;
}
