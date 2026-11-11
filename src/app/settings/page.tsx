'use client';

import { Loader2Icon, PlusIcon, RotateCcwIcon } from 'lucide-react';
import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import useSWR, { useSWRConfig } from 'swr';
import { timeAgo } from '@/components/activity-list';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { fetcher, send } from '@/lib/fetcher';
import { formatUsd } from '@/lib/money';
import { DEFAULT_RULES, TONE_LABEL, type Rules, type Tone } from '@/lib/types';

type Collaborator = { id: number; name: string; role: string; paypalEmail: string; defaultPercent: number };
type SettingsData = { rules: Rules; demoBatch: string | null; lastResetAt: string | null };

const TONES: Tone[] = ['gentle', 'friendly_firm', 'firm'];

function describeRules(r: Rules): string {
  const tones = r.autoSendTones.map((t) => TONE_LABEL[t]);
  const what = tones.length ? `${tones.join(' and ')} reminders` : 'no reminders';
  return `Auto-send ${what} up to ${formatUsd(r.autoSendMaxAmountCents)} when risk is under ${r.autoSendMaxRisk}.${r.autoSendInvoices ? ' New invoices are sent automatically too.' : ''} Everything else waits for you.`;
}

function RulesCard() {
  const { data, mutate } = useSWR<SettingsData>('/api/settings', fetcher);
  const [rules, setRules] = useState<Rules>(DEFAULT_RULES);
  const [saving, setSaving] = useState(false);
  useEffect(() => { if (data) setRules(data.rules); }, [data]);

  async function save() {
    setSaving(true);
    try {
      await send('/api/settings', 'PUT', { rules });
      toast.success('Autopilot rules saved');
      mutate();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Autopilot rules</CardTitle>
        <CardDescription>What the agent may send on its own. Anything outside these rules lands in your approval queue.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-5">
        <label className="block space-y-1">
          <span className="text-sm font-medium">Max invoice amount for auto-send</span>
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground">$</span>
            <Input
              type="number"
              min={0}
              step={50}
              value={rules.autoSendMaxAmountCents / 100}
              onChange={(e) => setRules({ ...rules, autoSendMaxAmountCents: Math.max(0, Math.round(Number(e.target.value) * 100)) })}
              className="w-32"
            />
          </div>
        </label>
        <label className="block space-y-1">
          <span className="text-sm font-medium">Only auto-send when risk is under <strong className="tabular-nums">{rules.autoSendMaxRisk}</strong></span>
          <input type="range" min={0} max={100} value={rules.autoSendMaxRisk} onChange={(e) => setRules({ ...rules, autoSendMaxRisk: Number(e.target.value) })} className="w-full max-w-sm accent-sky-600" />
        </label>
        <fieldset className="space-y-1">
          <legend className="text-sm font-medium">Tones the agent may send on its own</legend>
          <div className="flex flex-wrap gap-4">
            {TONES.map((t) => (
              <label key={t} className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={rules.autoSendTones.includes(t)}
                  onChange={(e) => setRules({ ...rules, autoSendTones: e.target.checked ? [...rules.autoSendTones, t] : rules.autoSendTones.filter((x) => x !== t) })}
                  className="size-4 accent-sky-600"
                />
                {TONE_LABEL[t]}
              </label>
            ))}
          </div>
        </fieldset>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={rules.autoSendInvoices} onChange={(e) => setRules({ ...rules, autoSendInvoices: e.target.checked })} className="size-4 accent-sky-600" />
          Send new invoices created by the copilot without asking
        </label>
        <p className="rounded-md bg-muted/60 px-3 py-2 text-sm">{describeRules(rules)}</p>
        <Button onClick={save} disabled={saving}>{saving && <Loader2Icon className="animate-spin" />} Save rules</Button>
      </CardContent>
    </Card>
  );
}

const EMPTY = { name: '', role: '', paypalEmail: '', defaultPercent: 20 };

function CollaboratorsCard() {
  const { data, mutate } = useSWR<Collaborator[]>('/api/collaborators', fetcher);
  const [editing, setEditing] = useState<(typeof EMPTY & { id?: number }) | null>(null);

  async function save() {
    if (!editing) return;
    try {
      await send('/api/collaborators', editing.id ? 'PUT' : 'POST', { ...editing, defaultPercent: Number(editing.defaultPercent) });
      toast.success('Collaborator saved');
      setEditing(null);
      mutate();
    } catch (e) {
      toast.error((e as Error).message);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Collaborators</CardTitle>
        <CardDescription>People who get a share of an invoice through PayPal Payouts when your client pays.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <ul className="divide-y">
          {(data ?? []).map((c) => (
            <li key={c.id} className="flex flex-wrap items-center gap-3 py-2 text-sm">
              <span className="font-medium">{c.name}</span>
              <span className="text-muted-foreground">{c.role}</span>
              <span className="text-muted-foreground">{c.paypalEmail}</span>
              <span className="ml-auto tabular-nums">default {c.defaultPercent}%</span>
              <Button size="xs" variant="ghost" onClick={() => setEditing(c)}>Edit</Button>
            </li>
          ))}
          {data?.length === 0 && <li className="py-2 text-sm text-muted-foreground">No collaborators yet.</li>}
        </ul>
        {editing ? (
          <div className="grid gap-2 rounded-lg border p-3 sm:grid-cols-2">
            <Input placeholder="Name" value={editing.name} onChange={(e) => setEditing({ ...editing, name: e.target.value })} />
            <Input placeholder="Role" value={editing.role} onChange={(e) => setEditing({ ...editing, role: e.target.value })} />
            <Input placeholder="PayPal (sandbox) email" value={editing.paypalEmail} onChange={(e) => setEditing({ ...editing, paypalEmail: e.target.value })} />
            <Input type="number" min={1} max={100} placeholder="Default %" value={editing.defaultPercent} onChange={(e) => setEditing({ ...editing, defaultPercent: Number(e.target.value) })} />
            <div className="flex gap-2 sm:col-span-2">
              <Button size="sm" onClick={save}>Save</Button>
              <Button size="sm" variant="ghost" onClick={() => setEditing(null)}>Cancel</Button>
            </div>
          </div>
        ) : (
          <Button size="sm" variant="outline" onClick={() => setEditing({ ...EMPTY })}><PlusIcon /> Add collaborator</Button>
        )}
      </CardContent>
    </Card>
  );
}

function ResetCard() {
  const { data, mutate } = useSWR<SettingsData>('/api/settings', fetcher);
  const { mutate: mutateAll } = useSWRConfig();
  const [busy, setBusy] = useState(false);

  async function reset() {
    if (!window.confirm('Reset the demo? This cancels the current sandbox invoices, clears all activity and creates a fresh set of 6 invoices.')) return;
    setBusy(true);
    try {
      const r = await send<{ batch: string }>('/api/demo/reset', 'POST');
      toast.success(`Demo reset: batch ${r.batch}. Go to Today and run the agent.`);
      mutate();
      mutateAll(() => true);
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card className="border-destructive/30">
      <CardHeader>
        <CardTitle>Demo</CardTitle>
        <CardDescription>
          Recreates the demo world in the PayPal sandbox: 6 clients with demo payment histories, 6 real invoices and 2 collaborators.
          {data?.lastResetAt && ` Last reset ${timeAgo(data.lastResetAt)} (batch ${data.demoBatch}).`}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Button variant="destructive" onClick={reset} disabled={busy}>
          {busy ? <Loader2Icon className="animate-spin" /> : <RotateCcwIcon />}
          {busy ? 'Creating sandbox invoices… (about 30s)' : 'Reset demo'}
        </Button>
      </CardContent>
    </Card>
  );
}

export default function SettingsPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Settings</h1>
        <p className="text-sm text-muted-foreground">Decide how much the agent can do without you.</p>
      </div>
      <RulesCard />
      <CollaboratorsCard />
      <ResetCard />
    </div>
  );
}
