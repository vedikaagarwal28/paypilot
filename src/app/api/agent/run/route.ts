import { runTriage, RunInProgressError } from '@/lib/agent/triage';
import { describePayPalError } from '@/lib/paypal/http';

export const dynamic = 'force-dynamic';
export const maxDuration = 120;

export async function POST() {
  try {
    return Response.json(await runTriage());
  } catch (e) {
    if (e instanceof RunInProgressError) return Response.json({ error: e.message }, { status: 409 });
    return Response.json({ error: describePayPalError(e) }, { status: 500 });
  }
}
