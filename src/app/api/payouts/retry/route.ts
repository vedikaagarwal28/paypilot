import { z } from 'zod';
import { retryFailedPayouts } from '@/lib/payments/on-paid';
import { describePayPalError } from '@/lib/paypal/http';

export const dynamic = 'force-dynamic';

const Body = z.object({ invoiceId: z.number().int().positive() });

export async function POST(req: Request) {
  const parsed = Body.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return Response.json({ error: 'Bad request' }, { status: 400 });
  try {
    return Response.json(await retryFailedPayouts(parsed.data.invoiceId));
  } catch (e) {
    return Response.json({ error: describePayPalError(e) }, { status: 502 });
  }
}
