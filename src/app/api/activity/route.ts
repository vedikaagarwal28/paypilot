import { getActivity } from '@/lib/queries/activity';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  const url = new URL(req.url);
  const actor = url.searchParams.get('actor') ?? undefined;
  try {
    return Response.json(await getActivity({ actor: actor === 'all' ? undefined : actor }));
  } catch (e) {
    return Response.json({ error: e instanceof Error ? e.message : String(e) }, { status: 500 });
  }
}
