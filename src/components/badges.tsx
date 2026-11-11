import { cn } from '@/lib/utils';
import type { Tone } from '@/lib/types';

const TONE_STYLE: Record<Tone, string> = {
  gentle: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300',
  friendly_firm: 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300',
  firm: 'bg-rose-100 text-rose-800 dark:bg-rose-900/40 dark:text-rose-300',
};

const TONE_TEXT: Record<Tone, string> = { gentle: 'Gentle', friendly_firm: 'Friendly-firm', firm: 'Firm' };

export function ToneBadge({ tone, className }: { tone: Tone | string | null; className?: string }) {
  if (!tone || !(tone in TONE_STYLE)) return null;
  return (
    <span className={cn('inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium', TONE_STYLE[tone as Tone], className)}>
      {TONE_TEXT[tone as Tone]}
    </span>
  );
}

export function riskColor(score: number) {
  if (score >= 70) return 'bg-rose-500';
  if (score >= 40) return 'bg-amber-500';
  return 'bg-emerald-500';
}

export function RiskBar({ score, className }: { score: number | null; className?: string }) {
  if (score === null || score === undefined) return <span className="text-xs text-muted-foreground">—</span>;
  return (
    <div className={cn('flex items-center gap-2', className)} title={`Risk ${score}/100`}>
      <div className="h-2 w-20 overflow-hidden rounded-full bg-muted">
        <div className={cn('h-full rounded-full', riskColor(score))} style={{ width: `${Math.max(score, 3)}%` }} />
      </div>
      <span className="w-7 text-right text-xs font-semibold tabular-nums">{score}</span>
    </div>
  );
}

export function DemoBadge({ children = 'Demo data' }: { children?: React.ReactNode }) {
  return (
    <span className="inline-flex items-center rounded-full border border-dashed border-violet-400 px-2 py-0.5 text-[11px] font-medium text-violet-700 dark:text-violet-300">
      {children}
    </span>
  );
}

const STATUS_STYLE: Record<string, string> = {
  PAID: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300',
  MARKED_AS_PAID: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300',
  SUCCESS: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300',
  SENT: 'bg-sky-100 text-sky-800 dark:bg-sky-900/40 dark:text-sky-300',
  UNPAID: 'bg-sky-100 text-sky-800 dark:bg-sky-900/40 dark:text-sky-300',
  PENDING: 'bg-sky-100 text-sky-800 dark:bg-sky-900/40 dark:text-sky-300',
  DRAFT: 'bg-muted text-muted-foreground',
  CANCELLED: 'bg-muted text-muted-foreground',
  FAILED: 'bg-rose-100 text-rose-800 dark:bg-rose-900/40 dark:text-rose-300',
  UNCLAIMED: 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300',
};

export function StatusBadge({ status }: { status: string }) {
  return (
    <span className={cn('inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium', STATUS_STYLE[status] ?? 'bg-muted text-muted-foreground')}>
      {status.replaceAll('_', ' ').toLowerCase()}
    </span>
  );
}
