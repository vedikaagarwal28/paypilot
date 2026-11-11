'use client';

import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import useSWR from 'swr';
import { timeAgo } from '@/components/activity-list';
import { StatusBadge } from '@/components/badges';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { fetcher } from '@/lib/fetcher';
import { formatUsd } from '@/lib/money';
import type { getCashflow } from '@/lib/queries/cashflow';

type CashflowData = Awaited<ReturnType<typeof getCashflow>>;

function Tile({ label, cents, hint, className }: { label: string; cents?: number; hint: string; className?: string }) {
  return (
    <div className="rounded-xl border bg-background p-4">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className={`text-2xl font-semibold tabular-nums ${className ?? ''}`}>{cents === undefined ? '—' : formatUsd(cents)}</p>
      <p className="text-xs text-muted-foreground">{hint}</p>
    </div>
  );
}

export default function CashflowPage() {
  const { data, error } = useSWR<CashflowData>('/api/cashflow', fetcher, { refreshInterval: 3000 });
  const chart = (data?.weekly ?? []).map((w) => ({
    week: new Date(`${w.weekStart}T00:00:00Z`).toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' }),
    Received: w.receivedCents / 100,
    Expected: w.expectedCents / 100,
  }));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Cash flow</h1>
        <p className="text-sm text-muted-foreground">What came in, what is still owed, and what went out to your collaborators.</p>
      </div>
      {error && <p className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">{error.message}</p>}

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Tile label="Received this month" cents={data?.receivedThisMonthCents} hint="Paid invoices" className="text-emerald-600" />
        <Tile label="Expected next 30 days" cents={data?.expectedNext30Cents} hint="Open invoices, incl. overdue" />
        <Tile label="At high risk" cents={data?.atRiskCents} hint="Open invoices with risk ≥ 70" className="text-rose-600" />
        <Tile label="Paid out to collaborators" cents={data?.paidOutCents} hint="Completed PayPal Payouts" className="text-sky-600" />
      </div>

      <Card>
        <CardHeader><CardTitle className="text-base">Weekly: received vs expected</CardTitle></CardHeader>
        <CardContent className="h-72">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chart} margin={{ left: 8, right: 8 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="week" tickLine={false} axisLine={false} fontSize={12} />
              <YAxis tickFormatter={(v) => `$${v >= 1000 ? `${v / 1000}k` : v}`} tickLine={false} axisLine={false} fontSize={12} width={48} />
              <Tooltip formatter={(v) => formatUsd(Number(v) * 100)} />
              <Legend />
              <Bar dataKey="Received" fill="#10b981" radius={[4, 4, 0, 0]} />
              <Bar dataKey="Expected" fill="#0ea5e9" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-base">Collaborator payouts</CardTitle></CardHeader>
        <CardContent>
          {!data?.payouts.length ? (
            <p className="text-sm text-muted-foreground">No payouts yet. When a client pays an invoice with a split, PayPilot pays your collaborators automatically.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="text-left text-xs text-muted-foreground">
                  <tr><th className="py-2">Collaborator</th><th>Invoice</th><th>Client</th><th className="text-right">Amount</th><th className="pl-4">Status</th><th className="text-right">When</th></tr>
                </thead>
                <tbody className="divide-y">
                  {data.payouts.map((p) => (
                    <tr key={p.id}>
                      <td className="py-2 font-medium">{p.collaboratorName}</td>
                      <td>{p.invoiceNumber}</td>
                      <td>{p.clientName}</td>
                      <td className="text-right tabular-nums">{formatUsd(p.amountCents)}</td>
                      <td className="pl-4"><StatusBadge status={p.status} /></td>
                      <td className="text-right text-xs text-muted-foreground">{timeAgo(p.createdAt)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
