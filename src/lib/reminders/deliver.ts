import { eq, sql } from 'drizzle-orm';
import { logActivity } from '@/lib/activity/log';
import { demoNow } from '@/lib/clock';
import { getDb } from '@/lib/db/client';
import { clients, invoices } from '@/lib/db/schema';
import { sendReminderEmail } from '@/lib/email/resend';
import { remindInvoice, updateInvoiceNote } from '@/lib/paypal/invoicing';

/**
 * PayPal ignores custom text on /remind, so the AI message is written onto the invoice note first,
 * then PayPal's official reminder goes out, then the same message is emailed via Resend.
 */
export async function deliverReminder(invoiceId: number, msg: { subject: string; body: string }): Promise<{ emailed: boolean }> {
  const db = getDb();
  const [row] = await db
    .select({ invoice: invoices, client: clients })
    .from(invoices)
    .innerJoin(clients, eq(invoices.clientId, clients.id))
    .where(eq(invoices.id, invoiceId));
  if (!row) throw new Error(`Invoice ${invoiceId} not found`);

  try {
    await updateInvoiceNote(row.invoice.paypalId, msg.body);
  } catch (e) {
    // Best-effort: the official PayPal reminder and the email still carry the message.
    await logActivity({ actor: 'system', action: 'note_update_failed', summary: `Could not write the message onto ${row.invoice.number}`, reason: e instanceof Error ? e.message : String(e), invoiceId });
  }
  await remindInvoice(row.invoice.paypalId);
  await db
    .update(invoices)
    .set({ remindersSent: sql`${invoices.remindersSent} + 1`, lastReminderAt: demoNow(), updatedAt: new Date() })
    .where(eq(invoices.id, invoiceId));

  try {
    await sendReminderEmail({ to: row.client.contactEmail, clientName: row.client.name, subject: msg.subject, body: msg.body, payUrl: row.invoice.payerViewUrl });
    return { emailed: true };
  } catch (e) {
    await logActivity({
      actor: 'system',
      action: 'email_failed',
      summary: `Reminder email to ${row.client.name} not delivered (PayPal reminder was sent)`,
      reason: e instanceof Error ? e.message : String(e),
      invoiceId,
    });
    return { emailed: false };
  }
}
