'use client';

import { useState } from 'react';
import useSWR from 'swr';
import { ActivityList } from '@/components/activity-list';
import { Card, CardContent } from '@/components/ui/card';
import { fetcher } from '@/lib/fetcher';
import type { ActivityItem } from '@/lib/queries/dashboard';
import { cn } from '@/lib/utils';

const FILTERS = [
  { value: 'all', label: 'All' },
  { value: 'agent', label: 'Agent' },
  { value: 'rule', label: 'Your rules' },
  { value: 'user', label: 'You' },
  { value: 'paypal', label: 'PayPal' },
  { value: 'system', label: 'System' },
];

export default function ActivityPage() {
  const [actor, setActor] = useState('all');
  const { data, error } = useSWR<ActivityItem[]>(`/api/activity?actor=${actor}`, fetcher, { refreshInterval: 3000 });

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Activity</h1>
        <p className="text-sm text-muted-foreground">Everything the agent, your rules and PayPal did, with the reason for each step.</p>
      </div>
      <div className="flex flex-wrap gap-1">
        {FILTERS.map((f) => (
          <button
            key={f.value}
            onClick={() => setActor(f.value)}
            className={cn('rounded-full border px-3 py-1 text-sm', actor === f.value ? 'border-foreground bg-foreground text-background' : 'bg-background hover:bg-muted')}
          >
            {f.label}
          </button>
        ))}
      </div>
      {error && <p className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">{error.message}</p>}
      <Card>
        <CardContent>
          <ActivityList items={data ?? []} empty="No activity yet." />
        </CardContent>
      </Card>
    </div>
  );
}
