import { logActivity } from '@/lib/activity/log';
import { formatUsd } from '@/lib/money';
import { rulesSchema } from '@/lib/settings/schema';
import { getSettings, saveSettings } from '@/lib/settings/store';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const s = await getSettings();
    return Response.json({ rules: s.rules, demoBatch: s.demoBatch, lastResetAt: s.lastResetAt?.toISOString() ?? null });
  } catch (e) {
    return Response.json({ error: e instanceof Error ? e.message : String(e) }, { status: 500 });
  }
}

export async function PUT(req: Request) {
  const parsed = rulesSchema.safeParse((await req.json().catch(() => ({}))).rules);
  if (!parsed.success) return Response.json({ error: parsed.error.issues[0].message }, { status: 400 });
  await saveSettings({ rules: parsed.data });
  const r = parsed.data;
  await logActivity({
    actor: 'user',
    action: 'rules_updated',
    summary: 'Updated autopilot rules',
    reason: `Auto-send ${r.autoSendTones.join(', ') || 'nothing'} up to ${formatUsd(r.autoSendMaxAmountCents)} when risk < ${r.autoSendMaxRisk}${r.autoSendInvoices ? '; new invoices too' : ''}`,
  });
  return Response.json({ rules: parsed.data });
}
