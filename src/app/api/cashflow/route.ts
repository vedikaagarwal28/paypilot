import { getCashflow } from '@/lib/queries/cashflow';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    return Response.json(await getCashflow());
  } catch (e) {
    return Response.json({ error: e instanceof Error ? e.message : String(e) }, { status: 500 });
  }
}
