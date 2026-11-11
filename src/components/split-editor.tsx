'use client';

// Placeholder until Task 14 adds editing.
import { formatUsd } from '@/lib/money';

type Split = { collaboratorId: number; name: string; percent: number };

export function SplitEditor({ amountCents, initial }: { invoiceId: number; amountCents: number; initial: Split[]; locked: boolean; onSaved: () => void }) {
  if (!initial.length) return <p className="text-sm text-muted-foreground">No split on this invoice.</p>;
  return (
    <ul className="space-y-1 text-sm">
      {initial.map((s) => (
        <li key={s.collaboratorId} className="flex justify-between">
          <span>{s.name} · {s.percent}%</span>
          <span className="tabular-nums">{formatUsd(Math.floor((amountCents * s.percent) / 100))}</span>
        </li>
      ))}
    </ul>
  );
}
