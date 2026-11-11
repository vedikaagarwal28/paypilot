export function shouldSync(lastSyncAt: number | null, now: number, intervalMs: number): boolean {
  return lastSyncAt === null || now - lastSyncAt >= intervalMs;
}
