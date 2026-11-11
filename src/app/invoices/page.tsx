'use client';

import { useState } from 'react';
import useSWR from 'swr';
import { InvoiceGrid } from '@/components/invoices/invoice-grid';
import { InvoiceSheet } from '@/components/invoices/invoice-sheet';
import { fetcher } from '@/lib/fetcher';
import type { InvoiceRow } from '@/lib/queries/invoices';

export default function InvoicesPage() {
  const { data, error, mutate } = useSWR<InvoiceRow[]>('/api/invoices', fetcher, { refreshInterval: 5000 });
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const selected = data?.find((r) => r.id === selectedId) ?? null;

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Invoices</h1>
        <p className="text-sm text-muted-foreground">Every invoice in your PayPal sandbox, ranked by how likely it is to be paid late. Click a row to see why.</p>
      </div>
      {error && <p className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">{error.message}</p>}
      {data && data.length === 0 && <p className="text-sm text-muted-foreground">No invoices yet. Reset the demo from Settings.</p>}
      <InvoiceGrid rows={data ?? []} onSelect={(r) => setSelectedId(r.id)} onChanged={() => mutate()} />
      <InvoiceSheet row={selected} onClose={() => setSelectedId(null)} onChanged={() => mutate()} />
    </div>
  );
}
