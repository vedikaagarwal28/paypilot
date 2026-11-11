import { desc, eq, inArray } from 'drizzle-orm';
import { daysBetween, demoNow } from '@/lib/clock';
import { getDb } from '@/lib/db/client';
import { clients, collaborators, invoices, splits } from '@/lib/db/schema';
import { getSettings } from '@/lib/settings/store';
import type { RiskFactor } from '@/lib/types';

export type InvoiceRow = {
  id: number;
  number: string;
  paypalId: string;
  clientId: number;
  clientName: string;
  historyNote: string;
  description: string;
  amountCents: number;
  dueDate: string;
  daysOverdue: number;
  status: string;
  riskScore: number | null;
  riskTone: string | null;
  riskExplanation: string | null;
  riskFactors: RiskFactor[];
  remindersSent: number;
  lastReminderAt: string | null;
  payerViewUrl: string | null;
  splits: { collaboratorId: number; name: string; percent: number }[];
  splitSummary: string;
};

export async function getInvoiceRows(opts: { clientId?: number } = {}): Promise<InvoiceRow[]> {
  const db = getDb();
  const { demoBatch } = await getSettings();
  if (!demoBatch) return [];
  const now = demoNow();
  const rows = await db
    .select({ invoice: invoices, client: clients })
    .from(invoices)
    .innerJoin(clients, eq(invoices.clientId, clients.id))
    .where(opts.clientId ? eq(invoices.clientId, opts.clientId) : eq(invoices.demoBatch, demoBatch))
    .orderBy(desc(invoices.riskScore));
  const ids = rows.map((r) => r.invoice.id);
  const splitRows = ids.length
    ? await db
      .select({ split: splits, collaborator: collaborators })
      .from(splits)
      .innerJoin(collaborators, eq(splits.collaboratorId, collaborators.id))
      .where(inArray(splits.invoiceId, ids))
    : [];

  return rows.map(({ invoice, client }) => {
    const s = splitRows
      .filter((x) => x.split.invoiceId === invoice.id)
      .map((x) => ({ collaboratorId: x.collaborator.id, name: x.collaborator.name, percent: x.split.percent }));
    return {
      id: invoice.id,
      number: invoice.number,
      paypalId: invoice.paypalId,
      clientId: client.id,
      clientName: client.name,
      historyNote: client.historyNote,
      description: invoice.description,
      amountCents: invoice.amountCents,
      dueDate: invoice.dueDate,
      daysOverdue: daysBetween(new Date(`${invoice.dueDate}T00:00:00Z`), now),
      status: invoice.status,
      riskScore: invoice.riskScore,
      riskTone: invoice.riskTone,
      riskExplanation: invoice.riskExplanation,
      riskFactors: invoice.riskFactors ?? [],
      remindersSent: invoice.remindersSent,
      lastReminderAt: invoice.lastReminderAt?.toISOString() ?? null,
      payerViewUrl: invoice.payerViewUrl,
      splits: s,
      splitSummary: s.map((x) => `${x.name.split(' ')[0]} ${x.percent}%`).join(' · '),
    };
  });
}
