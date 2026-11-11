import { getInvoiceRows } from '@/lib/queries/invoices';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    return Response.json(await getInvoiceRows());
  } catch (e) {
    return Response.json({ error: e instanceof Error ? e.message : String(e) }, { status: 500 });
  }
}
