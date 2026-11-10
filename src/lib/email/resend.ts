import { Resend } from 'resend';
import { env } from '@/lib/env';

export async function sendReminderEmail(i: {
  to: string;
  clientName: string;
  subject: string;
  body: string;
  payUrl: string | null;
}): Promise<{ id: string }> {
  const e = env();
  if (!e.RESEND_API_KEY) throw new Error('RESEND_API_KEY is not set');
  const text = i.payUrl ? `${i.body}\n\nPay securely with PayPal: ${i.payUrl}` : i.body;
  const { data, error } = await new Resend(e.RESEND_API_KEY).emails.send({
    from: e.RESEND_FROM,
    to: i.to,
    subject: i.subject,
    text,
    tags: [{ name: 'client', value: i.clientName.replace(/[^A-Za-z0-9_-]/g, '_') }],
  });
  if (error || !data) throw new Error(`Resend: ${error?.message ?? 'unknown error'}`);
  return { id: data.id };
}
