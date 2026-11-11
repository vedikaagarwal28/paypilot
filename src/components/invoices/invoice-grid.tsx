'use client';

import { AllCommunityModule, ModuleRegistry, themeQuartz, type ColDef, type ICellRendererParams } from 'ag-grid-community';
import { AgGridReact } from 'ag-grid-react';
import { ExternalLinkIcon, Loader2Icon, SendIcon } from 'lucide-react';
import { useMemo, useState } from 'react';
import { toast } from 'sonner';
import { RiskBar, StatusBadge } from '@/components/badges';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { PAID_STATUSES } from '@/lib/actions/can-execute';
import { send } from '@/lib/fetcher';
import { formatUsd } from '@/lib/money';
import type { InvoiceRow } from '@/lib/queries/invoices';

// AG Grid v33+ renders nothing (console error #272) unless modules are registered.
ModuleRegistry.registerModules([AllCommunityModule]);

const theme = themeQuartz.withParams({ fontFamily: 'inherit', headerFontWeight: 600, rowHoverColor: 'rgba(14,165,233,0.06)' });
const CLOSED = [...PAID_STATUSES, 'CANCELLED', 'DRAFT'];

type TotalsRow = { clientName: string; amountCents: number; isTotal: true; atRiskCents: number };

function RemindButton({ row, onChanged }: { row: InvoiceRow; onChanged: () => void }) {
  const [busy, setBusy] = useState(false);
  if (CLOSED.includes(row.status)) return null;
  return (
    <Button
      size="xs"
      variant="outline"
      disabled={busy}
      onClick={async (e) => {
        e.stopPropagation();
        setBusy(true);
        try {
          const r = await send<{ status: string; gateReason: string }>(`/api/invoices/${row.id}/remind`, 'POST');
          if (r.status === 'sent') toast.success(`Reminder sent to ${row.clientName}`, { description: r.gateReason });
          else toast.info(`Reminder for ${row.clientName} is waiting on the Today page`, { description: r.gateReason });
          onChanged();
        } catch (err) {
          toast.error((err as Error).message);
        } finally {
          setBusy(false);
        }
      }}
    >
      {busy ? <Loader2Icon className="animate-spin" /> : <SendIcon />} Remind
    </Button>
  );
}

export function InvoiceGrid({ rows, onSelect, onChanged }: { rows: InvoiceRow[]; onSelect: (r: InvoiceRow) => void; onChanged: () => void }) {
  const [quickFilter, setQuickFilter] = useState('');

  const columns = useMemo<ColDef<InvoiceRow>[]>(() => [
    { field: 'clientName', headerName: 'Client', minWidth: 150, pinned: 'left', cellClass: 'font-medium' },
    { field: 'number', headerName: 'Invoice #', minWidth: 140 },
    { field: 'description', headerName: 'Description', minWidth: 180, flex: 1 },
    { field: 'amountCents', headerName: 'Amount', minWidth: 110, type: 'rightAligned', valueFormatter: (p) => (p.value == null ? '' : formatUsd(p.value)) },
    { field: 'dueDate', headerName: 'Due', minWidth: 110 },
    {
      field: 'daysOverdue',
      headerName: 'Overdue',
      minWidth: 100,
      type: 'rightAligned',
      valueGetter: (p) => (p.data && !CLOSED.includes(p.data.status) && p.data.daysOverdue > 0 ? p.data.daysOverdue : null),
      valueFormatter: (p) => (p.value ? `${p.value}d` : ''),
      cellClass: 'text-rose-600',
    },
    { field: 'status', headerName: 'Status', minWidth: 110, cellRenderer: (p: ICellRendererParams<InvoiceRow>) => (p.data && !('isTotal' in p.data) ? <StatusBadge status={p.value} /> : null) },
    {
      field: 'riskScore',
      headerName: 'Risk',
      minWidth: 140,
      sort: 'desc',
      cellRenderer: (p: ICellRendererParams<InvoiceRow>) => (p.data && !('isTotal' in p.data) && !CLOSED.includes(p.data.status) ? <RiskBar score={p.value} className="h-full" /> : null),
    },
    { field: 'riskExplanation', headerName: 'Why', minWidth: 260, flex: 2, wrapText: true, autoHeight: true, cellClass: 'text-xs leading-snug py-2 text-muted-foreground' },
    { field: 'remindersSent', headerName: 'Reminders', minWidth: 100, type: 'rightAligned' },
    { field: 'splitSummary', headerName: 'Split', minWidth: 140 },
    {
      headerName: '',
      colId: 'actions',
      minWidth: 170,
      sortable: false,
      cellRenderer: (p: ICellRendererParams<InvoiceRow>) => {
        if (!p.data || 'isTotal' in p.data) return null;
        return (
          <div className="flex h-full items-center gap-2">
            <RemindButton row={p.data} onChanged={onChanged} />
            {p.data.payerViewUrl && (
              <a href={p.data.payerViewUrl} target="_blank" rel="noreferrer" onClick={(e) => e.stopPropagation()} className="text-sky-700" title="Open in PayPal">
                <ExternalLinkIcon className="size-4" />
              </a>
            )}
          </div>
        );
      },
    },
  ], [onChanged]);

  const totals = useMemo<TotalsRow[]>(() => {
    const open = rows.filter((r) => !CLOSED.includes(r.status));
    return [{
      clientName: `Outstanding (${open.length})`,
      amountCents: open.reduce((s, r) => s + r.amountCents, 0),
      atRiskCents: open.filter((r) => (r.riskScore ?? 0) >= 70).reduce((s, r) => s + r.amountCents, 0),
      isTotal: true,
    }];
  }, [rows]);

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-3">
        <Input placeholder="Filter by client, invoice, status…" value={quickFilter} onChange={(e) => setQuickFilter(e.target.value)} className="max-w-xs bg-background" />
        <span className="text-sm text-muted-foreground">
          Outstanding <strong className="text-foreground">{formatUsd(totals[0].amountCents)}</strong> · at high risk <strong className="text-rose-600">{formatUsd(totals[0].atRiskCents)}</strong>
        </span>
      </div>
      <div className="h-[560px] w-full">
        <AgGridReact<InvoiceRow>
          theme={theme}
          rowData={rows}
          columnDefs={columns}
          defaultColDef={{ sortable: true, resizable: true }}
          quickFilterText={quickFilter}
          pinnedBottomRowData={totals as unknown as InvoiceRow[]}
          getRowId={(p) => String(p.data.id)}
          onRowClicked={(e) => e.data && !('isTotal' in e.data) && onSelect(e.data)}
          rowClass="cursor-pointer"
          animateRows
        />
      </div>
    </div>
  );
}
