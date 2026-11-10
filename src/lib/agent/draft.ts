import { generateObject, type LanguageModelV1 } from 'ai';
import { z } from 'zod';
import { formatUsd } from '@/lib/money';
import { TONE_LABEL, type RiskFactor, type Tone } from '@/lib/types';
import { getModel } from './model';

export type DraftContext = {
  clientName: string;
  invoiceNumber: string;
  description: string;
  amountCents: number;
  dueDate: string;
  daysOverdue: number;
  tone: Tone;
  factors: RiskFactor[];
  historyNote: string;
  remindersSent: number;
};

export type Draft = { subject: string; body: string; explanation: string; usedFallback: boolean };

const DraftSchema = z.object({
  subject: z.string().max(90),
  body: z.string().max(1200),
  explanation: z.string().max(280),
});

const SYSTEM = `You write payment reminders for a freelancer, in first person, as the freelancer.
Rules:
- Use only the facts given. Never invent late fees, interest, legal threats, dates or amounts.
- Use the amount exactly as written (it is already formatted).
- Tone guide:
  - gentle: assume an oversight, warm, 3-5 sentences.
  - friendly-firm: friendly but clear; ask for payment by a specific date 5 days from today.
  - firm: state how many days overdue, ask for payment within 3 days, mention you will pause further work until it is settled; stay polite.
- Plain text, no markdown, no placeholders like [Name]. Sign off as "Thanks," with no name.
- "explanation" is 1-2 sentences for the freelancer (not the client) on why this tone fits, citing the risk factors.`;

function daysText(n: number) {
  return `${n} day${n === 1 ? '' : 's'}`;
}

export function fallbackDraft(ctx: DraftContext): Draft & { usedFallback: true } {
  const amount = formatUsd(ctx.amountCents);
  const ref = `invoice ${ctx.invoiceNumber} (${ctx.description}) for ${amount}`;
  const overdue = ctx.daysOverdue > 0 ? `${daysText(ctx.daysOverdue)} overdue` : `due on ${ctx.dueDate}`;
  const bodies: Record<Tone, string> = {
    gentle: `Hi ${ctx.clientName} team,\n\nJust a friendly note that ${ref} is now ${overdue}. It may simply have slipped through, so I wanted to send a quick reminder. You can pay it directly through PayPal using the link below.\n\nThanks,`,
    friendly_firm: `Hi ${ctx.clientName} team,\n\nI'm following up on ${ref}, which is now ${overdue}. Could you please arrange payment within the next 5 days? You can pay it directly through PayPal using the link below. Let me know if anything is holding it up.\n\nThanks,`,
    firm: `Hi ${ctx.clientName} team,\n\n${ref[0].toUpperCase()}${ref.slice(1)} is now ${overdue}. Please settle it within 3 days using the PayPal link below. I'll need to pause further work until this invoice is paid.\n\nThanks,`,
  };
  const top = ctx.factors.slice(0, 2).map((f) => f.label).join('; ');
  return {
    subject: `${ctx.tone === 'gentle' ? 'Friendly reminder' : 'Payment reminder'}: invoice ${ctx.invoiceNumber}`,
    body: bodies[ctx.tone],
    explanation: `Template ${TONE_LABEL[ctx.tone]} reminder${top ? ` — ${top}` : ''}.`,
    usedFallback: true,
  };
}

export async function draftReminder(ctx: DraftContext, opts: { model?: LanguageModelV1; timeoutMs?: number } = {}): Promise<Draft> {
  try {
    const { object } = await generateObject({
      model: opts.model ?? getModel(),
      schema: DraftSchema,
      system: SYSTEM,
      prompt: JSON.stringify({
        tone: TONE_LABEL[ctx.tone],
        client: ctx.clientName,
        invoiceNumber: ctx.invoiceNumber,
        description: ctx.description,
        amount: formatUsd(ctx.amountCents),
        dueDate: ctx.dueDate,
        daysOverdue: ctx.daysOverdue,
        remindersAlreadySent: ctx.remindersSent,
        clientHistory: ctx.historyNote,
        riskFactors: ctx.factors.map((f) => f.label),
      }),
      temperature: 0.3,
      maxRetries: 1,
      abortSignal: AbortSignal.timeout(opts.timeoutMs ?? 20_000),
    });
    return { ...object, usedFallback: false };
  } catch {
    return fallbackDraft(ctx);
  }
}
