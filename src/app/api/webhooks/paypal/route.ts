// Temporary stub (Task 0): log raw webhook bodies so the sandbox smoke test can be observed in Render logs.
export async function POST(req: Request) {
  console.log('[paypal-webhook]', await req.text());
  return new Response(null, { status: 200 });
}
