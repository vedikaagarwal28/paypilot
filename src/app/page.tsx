'use client';

import { BotIcon, Loader2Icon } from 'lucide-react';
import Link from 'next/link';
import { useState } from 'react';
import { toast } from 'sonner';
import useSWR from 'swr';
import { ActivityList, timeAgo } from '@/components/activity-list';
import { ActionCard } from '@/components/today/action-card';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { fetcher, send } from '@/lib/fetcher';
import type { Dashboard } from '@/lib/queries/dashboard';
import type { TriageSummary } from '@/lib/types';

function Stat({ label, value, tone }: { label: string; value: number | string; tone?: string }) {
  return (
    <div className="rounded-xl border bg-background p-4">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className={`text-2xl font-semibold tabular-nums ${tone ?? ''}`}>{value}</p>
    </div>
  );
}

export default function TodayPage() {
  const { data, error, mutate } = useSWR<Dashboard>('/api/dashboard', fetcher, { refreshInterval: 3000 });
  const [running, setRunning] = useState(false);

  async function runAgent() {
    setRunning(true);
    try {
      const s = await send<TriageSummary>('/api/agent/run', 'POST');
      toast.success(`Agent run: ${s.needsAttention} need attention · ${s.autoSent} sent automatically · ${s.queued} waiting for you`);
      mutate();
    } catch (e) {
      toast.error((e as { status?: number }).status === 409 ? 'Agent is already running' : (e as Error).message);
    } finally {
      setRunning(false);
    }
  }

  const run = data?.lastRun;
  const queue = data?.queue ?? [];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Today</h1>
          <p className="text-sm text-muted-foreground">
            Your collections agent checks every open invoice, sends what your rules allow and asks you about the rest.
          </p>
        </div>
        <Button size="lg" onClick={runAgent} disabled={running}>
          {running ? <Loader2Icon className="animate-spin" /> : <BotIcon />}
          {running ? 'Agent is working…' : 'Run agent'}
        </Button>
      </div>

      {error && <p className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">{error.message}</p>}

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Stat label="Open invoices" value={run?.open ?? '—'} />
        <Stat label="Need attention" value={run?.needsAttention ?? '—'} tone="text-amber-600" />
        <Stat label="Sent automatically" value={run?.autoSent ?? '—'} tone="text-emerald-600" />
        <Stat label="Waiting for you" value={queue.filter((q) => q.status !== 'failed').length} tone="text-sky-600" />
      </div>
      {run && <p className="-mt-3 text-xs text-muted-foreground">Last agent run {timeAgo(run.finishedAt)}</p>}

      <div className="grid gap-6 lg:grid-cols-[1fr_340px]">
        <section className="space-y-3">
          <h2 className="font-semibold">Waiting for your approval</h2>
          {!data && !error && <Loader2Icon className="size-5 animate-spin text-muted-foreground" />}
          {data && queue.length === 0 && (
            <Card>
              <CardContent className="py-8 text-center text-sm text-muted-foreground">
                {run ? 'All clear. Nothing needs you right now.' : 'Run the agent to triage your open invoices.'}
              </CardContent>
            </Card>
          )}
          {queue.map((item) => <ActionCard key={item.actionId} item={item} onChanged={() => mutate()} />)}
        </section>

        <aside className="space-y-3">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Recent agent actions</CardTitle>
            </CardHeader>
            <CardContent>
              <ActivityList items={data?.recent ?? []} empty="No activity yet. Reset the demo from Settings, then run the agent." />
              <Link href="/activity" className="mt-2 inline-block text-xs text-muted-foreground hover:underline">Full activity log →</Link>
            </CardContent>
          </Card>
          {data?.lastResetAt && <p className="text-xs text-muted-foreground">Demo last reset {timeAgo(data.lastResetAt)}</p>}
        </aside>
      </div>
    </div>
  );
}
