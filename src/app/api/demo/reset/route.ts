import { resetDemo, ResetCooldownError } from '@/lib/demo/reset';
import { describePayPalError } from '@/lib/paypal/http';

export const dynamic = 'force-dynamic';
export const maxDuration = 120;

export async function POST() {
  try {
    return Response.json(await resetDemo());
  } catch (e) {
    if (e instanceof ResetCooldownError) return Response.json({ error: e.message }, { status: 429 });
    return Response.json({ error: describePayPalError(e) }, { status: 500 });
  }
}
