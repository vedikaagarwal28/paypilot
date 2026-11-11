import { BotIcon, CogIcon, ShieldCheckIcon, UserIcon, WalletIcon } from 'lucide-react';
import type { ActivityItem } from '@/lib/queries/dashboard';

const ACTOR = {
  agent: { icon: BotIcon, label: 'Agent', className: 'bg-violet-100 text-violet-700 dark:bg-violet-900/40 dark:text-violet-300' },
  rule: { icon: ShieldCheckIcon, label: 'Your rules', className: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300' },
  user: { icon: UserIcon, label: 'You', className: 'bg-sky-100 text-sky-700 dark:bg-sky-900/40 dark:text-sky-300' },
  paypal: { icon: WalletIcon, label: 'PayPal', className: 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300' },
  system: { icon: CogIcon, label: 'System', className: 'bg-muted text-muted-foreground' },
} as const;

export function timeAgo(iso: string): string {
  const s = Math.round((Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 60) return 'just now';
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return new Date(iso).toLocaleDateString();
}

export function ActivityList({ items, empty = 'Nothing yet.' }: { items: ActivityItem[]; empty?: string }) {
  if (!items.length) return <p className="text-sm text-muted-foreground">{empty}</p>;
  return (
    <ul className="divide-y">
      {items.map((a) => {
        const actor = ACTOR[a.actor as keyof typeof ACTOR] ?? ACTOR.system;
        const Icon = actor.icon;
        return (
          <li key={a.id} className="flex gap-3 py-2.5">
            <span className={`mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-full ${actor.className}`} title={actor.label}>
              <Icon className="size-3.5" />
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-sm">{a.summary}</p>
              {a.reason && <p className="text-xs text-muted-foreground">{a.reason}</p>}
            </div>
            <time className="shrink-0 text-xs text-muted-foreground" title={new Date(a.at).toLocaleString()}>{timeAgo(a.at)}</time>
          </li>
        );
      })}
    </ul>
  );
}
