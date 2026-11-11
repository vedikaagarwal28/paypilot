import { desc, eq } from 'drizzle-orm';
import { aggregateCashflow, type Cashflow } from '@/lib/cashflow/aggregate';
import { demoNow } from '@/lib/clock';
import { getDb } from '@/lib/db/client';
import { clients, collaborators, invoices, payouts } from '@/lib/db/schema';
import { getSettings } from '@/lib/settings/store';

export type PayoutRow = {
  id: number;
  collaboratorName: string;
  invoiceNumber: string;
  clientName: string;
  amountCents: number;
  status: string;
  createdAt: string;
};

export async function getCashflow(): Promise<Cashflow & { payouts: PayoutRow[] }> {
  const db = getDb();
  const { demoBatch } = await getSettings();
  const inv = demoBatch ? await db.select().from(invoices).where(eq(invoices.demoBatch, demoBatch)) : [];
  const rows = await db
    .select({ payout: payouts, collaborator: collaborators, invoice: invoices, client: clients })
    .from(payouts)
    .innerJoin(collaborators, eq(payouts.collaboratorId, collaborators.id))
    .innerJoin(invoices, eq(payouts.invoiceId, invoices.id))
    .innerJoin(clients, eq(invoices.clientId, clients.id))
    .orderBy(desc(payouts.createdAt));
  return {
    ...aggregateCashflow(inv, rows.map((r) => r.payout), demoNow()),
    payouts: rows.map((r) => ({
      id: r.payout.id,
      collaboratorName: r.collaborator.name,
      invoiceNumber: r.invoice.number,
      clientName: r.client.name,
      amountCents: r.payout.amountCents,
      status: r.payout.status,
      createdAt: r.payout.createdAt.toISOString(),
    })),
  };
}
