'use client';

import { PlusIcon, TrashIcon } from 'lucide-react';
import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import useSWR from 'swr';
import { Button } from '@/components/ui/button';
import { fetcher, send } from '@/lib/fetcher';
import { formatUsd } from '@/lib/money';

type Split = { collaboratorId: number; name: string; percent: number };
type Collaborator = { id: number; name: string; defaultPercent: number };

export function SplitEditor({ invoiceId, amountCents, initial, locked, onSaved }: {
  invoiceId: number;
  amountCents: number;
  initial: Split[];
  locked: boolean;
  onSaved: () => void;
}) {
  const { data: collabs } = useSWR<Collaborator[]>('/api/collaborators', fetcher);
  const [rows, setRows] = useState(initial.map(({ collaboratorId, percent }) => ({ collaboratorId, percent })));
  const [saving, setSaving] = useState(false);
  const initialKey = JSON.stringify(initial);

  // Reset local edits when a different invoice (or fresh server data) comes in.
  useEffect(() => setRows(initial.map(({ collaboratorId, percent }) => ({ collaboratorId, percent }))), [invoiceId, initialKey]); // eslint-disable-line react-hooks/exhaustive-deps

  const total = rows.reduce((s, r) => s + (Number(r.percent) || 0), 0);
  const dupes = new Set(rows.map((r) => r.collaboratorId)).size !== rows.length;
  const error = total > 100 ? 'Splits add up to more than 100%' : dupes ? 'Each collaborator can appear only once' : null;
  const unused = (collabs ?? []).filter((c) => !rows.some((r) => r.collaboratorId === c.id));

  if (locked) {
    if (!initial.length) return <p className="text-sm text-muted-foreground">No split on this invoice.</p>;
    return (
      <ul className="space-y-1 text-sm">
        {initial.map((s) => (
          <li key={s.collaboratorId} className="flex justify-between">
            <span>{s.name} · {s.percent}%</span>
            <span className="tabular-nums">{formatUsd(Math.floor((amountCents * s.percent) / 100))}</span>
          </li>
        ))}
        <li className="text-xs text-muted-foreground">Paid invoice: split is locked.</li>
      </ul>
    );
  }

  async function save() {
    setSaving(true);
    try {
      await send(`/api/invoices/${invoiceId}/splits`, 'PUT', { splits: rows.map((r) => ({ collaboratorId: r.collaboratorId, percent: Number(r.percent) })) });
      toast.success('Split saved. Collaborators are paid automatically when this invoice is paid.');
      onSaved();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-2">
      {rows.map((r, i) => (
        <div key={i} className="flex items-center gap-2">
          <select
            value={r.collaboratorId}
            onChange={(e) => setRows(rows.map((x, j) => (j === i ? { ...x, collaboratorId: Number(e.target.value) } : x)))}
            className="h-8 flex-1 rounded-md border bg-background px-2 text-sm"
          >
            {(collabs ?? []).map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
          <input
            type="number"
            min={1}
            max={100}
            value={r.percent}
            onChange={(e) => setRows(rows.map((x, j) => (j === i ? { ...x, percent: Number(e.target.value) } : x)))}
            className="h-8 w-16 rounded-md border bg-background px-2 text-right text-sm tabular-nums"
            aria-label="Percent"
          />
          <span className="w-6 text-sm text-muted-foreground">%</span>
          <span className="w-20 text-right text-sm tabular-nums">{formatUsd(Math.floor((amountCents * (Number(r.percent) || 0)) / 100))}</span>
          <Button size="icon-sm" variant="ghost" onClick={() => setRows(rows.filter((_, j) => j !== i))} aria-label="Remove">
            <TrashIcon />
          </Button>
        </div>
      ))}
      <div className="flex items-center gap-2">
        <Button
          size="sm"
          variant="outline"
          disabled={!unused.length}
          onClick={() => setRows([...rows, { collaboratorId: unused[0].id, percent: unused[0].defaultPercent }])}
        >
          <PlusIcon /> Add collaborator
        </Button>
        <span className={`ml-auto text-xs ${error ? 'text-destructive' : 'text-muted-foreground'}`}>
          {error ?? `Total ${total}% · you keep ${formatUsd(amountCents - rows.reduce((s, r) => s + Math.floor((amountCents * (Number(r.percent) || 0)) / 100), 0))}`}
        </span>
      </div>
      <Button size="sm" onClick={save} disabled={saving || !!error}>Save split</Button>
    </div>
  );
}
