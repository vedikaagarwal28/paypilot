'use client';

import { ExternalLinkIcon, Loader2Icon } from 'lucide-react';
import Link from 'next/link';
import { useState } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { send } from '@/lib/fetcher';
import { DemoBadge, RiskBar, StatusBadge, ToneBadge, riskColor } from '@/components/badges';
import { SplitEditor } from '@/components/split-editor';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { formatUsd } from '@/lib/money';
import type { InvoiceRow } from '@/lib/queries/invoices';
import { PAID_STATUSES } from '@/lib/actions/can-execute';

function RecordPaymentButton({ invoiceId, onDone }: { invoiceId: number; onDone: () => void }) {
  const [busy, setBusy] = useState(false);
  return (
    <Button
      size="sm"
      variant="outline"
      disabled={busy}
      onClick={async () => {
        setBusy(true);
        try {
          await send(`/api/invoices/${invoiceId}/record-payment`, 'POST');
          toast.success('Payment recorded in PayPal. Splits pay out automatically.');
          onDone();
        } catch (e) {
          toast.error((e as Error).message);
        } finally {
          setBusy(false);
        }
      }}
      title="Fallback when the sandbox checkout can't be used: records the payment on the real PayPal invoice"
    >
      {busy && <Loader2Icon className="animate-spin" />} Record payment
    </Button>
  );
}

export function InvoiceSheet({ row, onClose, onChanged }: { row: InvoiceRow | null; onClose: () => void; onChanged: () => void }) {
  const maxPoints = Math.max(1, ...(row?.riskFactors ?? []).map((f) => f.points));
  return (
    <Sheet open={row !== null} onOpenChange={(o) => !o && onClose()}>
      <SheetContent side="right" className="w-full overflow-y-auto sm:max-w-md">
        {row && (
          <>
            <SheetHeader>
              <SheetTitle>{row.clientName} · {row.number}</SheetTitle>
              <SheetDescription>{row.description}</SheetDescription>
            </SheetHeader>
            <div className="space-y-5 px-4 pb-6">
              <div className="flex flex-wrap items-center gap-3">
                <span className="text-xl font-semibold tabular-nums">{formatUsd(row.amountCents)}</span>
                <StatusBadge status={row.status} />
                <ToneBadge tone={row.riskTone} />
                <RiskBar score={row.riskScore} />
              </div>
              <p className="text-sm text-muted-foreground">
                Due {row.dueDate}
                {row.daysOverdue > 0 && !PAID_STATUSES.includes(row.status) ? ` · ${row.daysOverdue} days overdue` : ''} · {row.remindersSent} reminder{row.remindersSent === 1 ? '' : 's'} sent
              </p>

              <section className="space-y-2">
                <h3 className="text-sm font-semibold">Why this risk score</h3>
                {row.riskFactors.length === 0 && <p className="text-sm text-muted-foreground">Not scored yet. Run the agent.</p>}
                {row.riskFactors.map((f) => (
                  <div key={f.label} className="space-y-1">
                    <div className="flex justify-between text-xs"><span>{f.label}</span><span className="tabular-nums text-muted-foreground">+{f.points}</span></div>
                    <div className="h-1.5 rounded-full bg-muted">
                      <div className={`h-full rounded-full ${riskColor(row.riskScore ?? 0)}`} style={{ width: `${(f.points / maxPoints) * 100}%` }} />
                    </div>
                  </div>
                ))}
                {row.riskExplanation && <p className="rounded-md bg-muted/60 px-3 py-2 text-sm">{row.riskExplanation}</p>}
              </section>

              <section className="space-y-1">
                <h3 className="flex items-center gap-2 text-sm font-semibold">Client history <DemoBadge /></h3>
                <p className="text-sm">{row.historyNote}</p>
                <Link href={`/clients/${row.clientId}`} className="text-xs text-muted-foreground hover:underline">Open client →</Link>
              </section>

              <section className="space-y-2">
                <h3 className="text-sm font-semibold">Split with collaborators</h3>
                <SplitEditor invoiceId={row.id} amountCents={row.amountCents} initial={row.splits} locked={PAID_STATUSES.includes(row.status)} onSaved={onChanged} />
              </section>

              <div className="flex flex-wrap items-center gap-3">
                {row.payerViewUrl && (
                  <a href={row.payerViewUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-sm text-sky-700 hover:underline">
                    Pay as client in PayPal <ExternalLinkIcon className="size-3.5" />
                  </a>
                )}
                {!PAID_STATUSES.includes(row.status) && !['DRAFT', 'CANCELLED'].includes(row.status) && (
                  <RecordPaymentButton invoiceId={row.id} onDone={onChanged} />
                )}
              </div>
            </div>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}
