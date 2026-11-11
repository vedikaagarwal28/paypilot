import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ActivityList } from '@/components/activity-list';
import { DemoBadge, RiskBar, StatusBadge, ToneBadge } from '@/components/badges';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { PAID_STATUSES } from '@/lib/actions/can-execute';
import { formatUsd } from '@/lib/money';
import { getClient } from '@/lib/queries/client';

export const dynamic = 'force-dynamic';

export default async function ClientPage({ params }: { params: Promise<{ id: string }> }) {
  const data = await getClient(Number((await params).id));
  if (!data) notFound();
  const { client, invoices, activity } = data;
  const open = invoices.filter((i) => ![...PAID_STATUSES, 'CANCELLED', 'DRAFT'].includes(i.status));
  const worst = open.reduce<(typeof open)[number] | null>((m, i) => ((i.riskScore ?? 0) > (m?.riskScore ?? -1) ? i : m), null);

  return (
    <div className="space-y-6">
      <Link href="/invoices" className="text-sm text-muted-foreground hover:underline">← Invoices</Link>
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="text-2xl font-semibold tracking-tight">{client.name}</h1>
        {worst && <ToneBadge tone={worst.riskTone} />}
        {worst && <RiskBar score={worst.riskScore} />}
      </div>

      <Card>
        <CardHeader><CardTitle className="flex items-center gap-2 text-base">Payment history <DemoBadge /></CardTitle></CardHeader>
        <CardContent className="space-y-1 text-sm">
          <p>
            Pays {client.avgDaysLate} days late on average · {Math.round(client.pctPaidLate * 100)}% of invoices late · ignored {client.ignoredReminders} reminder{client.ignoredReminders === 1 ? '' : 's'}
          </p>
          <p className="text-muted-foreground">{client.historyNote} · typical invoice {formatUsd(client.typicalAmountCents)}</p>
        </CardContent>
      </Card>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader><CardTitle className="text-base">Invoices</CardTitle></CardHeader>
          <CardContent>
            <ul className="divide-y">
              {invoices.map((i) => (
                <li key={i.id} className="flex flex-wrap items-center gap-3 py-2 text-sm">
                  <span className="font-medium">{i.number}</span>
                  <span className="text-muted-foreground">{i.description}</span>
                  <span className="ml-auto tabular-nums">{formatUsd(i.amountCents)}</span>
                  <StatusBadge status={i.status} />
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle className="text-base">Activity</CardTitle></CardHeader>
          <CardContent><ActivityList items={activity} empty="No activity for this client yet." /></CardContent>
        </Card>
      </div>
    </div>
  );
}
