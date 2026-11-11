'use client';

import { CheckIcon, Loader2Icon, RotateCcwIcon, XIcon } from 'lucide-react';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { RiskBar, ToneBadge } from '@/components/badges';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { send } from '@/lib/fetcher';
import { formatUsd } from '@/lib/money';
import type { QueueItem } from '@/lib/queries/dashboard';
import type { Tone } from '@/lib/types';
import { cn } from '@/lib/utils';

const TONES: { value: Tone; label: string }[] = [
  { value: 'gentle', label: 'Gentle' },
  { value: 'friendly_firm', label: 'Friendly-firm' },
  { value: 'firm', label: 'Firm' },
];

export function ActionCard({ item, onChanged }: { item: QueueItem; onChanged: () => void }) {
  const [subject, setSubject] = useState(item.subject ?? '');
  const [body, setBody] = useState(item.body ?? '');
  const [busy, setBusy] = useState<null | 'approve' | 'skip' | 'retry' | 'redraft'>(null);
  const isReminder = item.type === 'send_reminder';

  // Keep local edits unless the server text changed underneath (e.g. after a redraft).
  useEffect(() => setSubject(item.subject ?? ''), [item.subject]);
  useEffect(() => setBody(item.body ?? ''), [item.body]);

  async function act(op: 'approve' | 'skip' | 'retry') {
    setBusy(op);
    try {
      const { status } = await send<{ status: string }>(`/api/actions/${item.actionId}`, 'PATCH', { op, subject, body });
      if (op === 'approve') {
        if (status === 'sent') toast.success(isReminder ? `Reminder sent to ${item.clientName}` : `Invoice ${item.invoiceNumber} sent`);
        else if (status === 'skipped') toast.info('Skipped: the invoice was already paid or cancelled');
        else if (status === 'failed') toast.error('PayPal rejected it. See the card for details.');
      }
      onChanged();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(null);
    }
  }

  async function redraft(tone: Tone) {
    if (tone === item.tone) return;
    setBusy('redraft');
    try {
      const d = await send<{ subject: string; body: string }>(`/api/actions/${item.actionId}/redraft`, 'POST', { tone });
      setSubject(d.subject);
      setBody(d.body);
      onChanged();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(null);
    }
  }

  const failed = item.status === 'failed';

  return (
    <Card className={cn(failed && 'border-destructive/50')}>
      <CardContent className="space-y-3">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
          <Link href={`/clients/${item.clientId}`} className="font-semibold hover:underline">{item.clientName}</Link>
          <span className="text-sm text-muted-foreground">{item.invoiceNumber}</span>
          <span className="text-sm font-medium tabular-nums">{formatUsd(item.amountCents)}</span>
          {isReminder && item.daysOverdue > 0 && <span className="text-sm text-rose-600">{item.daysOverdue} days overdue</span>}
          <span className="ml-auto flex items-center gap-2">
            {isReminder && <RiskBar score={item.riskScore} />}
            {isReminder ? <ToneBadge tone={item.tone} /> : <span className="rounded-full bg-sky-100 px-2 py-0.5 text-xs font-medium text-sky-800">New invoice</span>}
          </span>
        </div>

        <div className="space-y-1 rounded-md bg-muted/60 px-3 py-2 text-sm">
          {isReminder && <p><span className="font-medium">Why this tone: </span>{item.reason}</p>}
          <p className="text-muted-foreground"><span className="font-medium text-foreground">Why it waits for you: </span>{item.gateReason.replace(/^Needs your approval: /, '')}</p>
          {item.usedFallback && <p className="text-xs text-amber-700">Template draft: the AI was unavailable, so a safe template was used.</p>}
        </div>

        {failed && <p className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">{item.error}</p>}

        {isReminder && (
          <>
            <div className="flex flex-wrap items-center gap-1">
              <span className="mr-1 text-xs text-muted-foreground">Tone</span>
              {TONES.map((t) => (
                <button
                  key={t.value}
                  disabled={busy !== null || failed}
                  onClick={() => redraft(t.value)}
                  className={cn('rounded-full border px-2.5 py-0.5 text-xs', item.tone === t.value ? 'border-foreground bg-foreground text-background' : 'hover:bg-muted')}
                >
                  {t.label}
                </button>
              ))}
              {busy === 'redraft' && <Loader2Icon className="ml-1 size-3.5 animate-spin" />}
            </div>
            <Input value={subject} onChange={(e) => setSubject(e.target.value)} disabled={failed} aria-label="Subject" />
            <Textarea value={body} onChange={(e) => setBody(e.target.value)} rows={6} disabled={failed} aria-label="Message" className="text-sm" />
          </>
        )}

        <div className="flex gap-2">
          {failed ? (
            <Button onClick={() => act('retry')} disabled={busy !== null}>
              {busy === 'retry' ? <Loader2Icon className="animate-spin" /> : <RotateCcwIcon />} Retry
            </Button>
          ) : (
            <Button onClick={() => act('approve')} disabled={busy !== null || item.status === 'executing'}>
              {busy === 'approve' || item.status === 'executing' ? <Loader2Icon className="animate-spin" /> : <CheckIcon />}
              {isReminder ? 'Approve & send' : 'Approve & send invoice'}
            </Button>
          )}
          <Button variant="ghost" onClick={() => act('skip')} disabled={busy !== null || failed}>
            <XIcon /> Skip
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
