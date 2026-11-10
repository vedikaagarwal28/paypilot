import { eq } from 'drizzle-orm';
import { getDb } from '@/lib/db/client';
import { settings } from '@/lib/db/schema';
import { DEFAULT_RULES, type Rules } from '@/lib/types';

export async function getSettings(): Promise<{ rules: Rules; demoBatch: string | null; lastResetAt: Date | null }> {
  const [row] = await getDb().select().from(settings).where(eq(settings.id, 1));
  return row
    ? { rules: { ...DEFAULT_RULES, ...row.rules }, demoBatch: row.demoBatch, lastResetAt: row.lastResetAt }
    : { rules: DEFAULT_RULES, demoBatch: null, lastResetAt: null };
}

export async function saveSettings(patch: Partial<{ rules: Rules; demoBatch: string; lastResetAt: Date }>): Promise<void> {
  const current = await getSettings();
  const next = { ...current, ...patch };
  await getDb()
    .insert(settings)
    .values({ id: 1, rules: next.rules, demoBatch: next.demoBatch, lastResetAt: next.lastResetAt })
    .onConflictDoUpdate({ target: settings.id, set: { rules: next.rules, demoBatch: next.demoBatch, lastResetAt: next.lastResetAt } });
}
