import { getDashboard } from '@/lib/queries/dashboard';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    return Response.json(await getDashboard());
  } catch (e) {
    return Response.json({ error: e instanceof Error ? e.message : String(e) }, { status: 500 });
  }
}
