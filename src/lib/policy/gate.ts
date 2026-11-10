import { formatUsd } from '@/lib/money';
import { TONE_LABEL, type ActionType, type Rules, type Tone } from '@/lib/types';

/** Decides whether an agent action may run on its own under the user's rules. Checks: type → tone → amount → risk. */
export function decide(
  a: { type: ActionType; amountCents: number; riskScore: number; tone: Tone | null },
  r: Rules,
): { auto: boolean; reason: string } {
  if (a.type === 'send_invoice') {
    return r.autoSendInvoices
      ? { auto: true, reason: 'Sent automatically: your rules allow sending new invoices' }
      : { auto: false, reason: 'Needs your approval: sending new invoices always needs you' };
  }
  if (!a.tone || !r.autoSendTones.includes(a.tone)) {
    return { auto: false, reason: `Needs your approval: ${a.tone ? TONE_LABEL[a.tone] : 'untoned'} reminders always need you` };
  }
  if (a.amountCents > r.autoSendMaxAmountCents) {
    return { auto: false, reason: `Needs your approval: ${formatUsd(a.amountCents)} is over your ${formatUsd(r.autoSendMaxAmountCents)} auto-send limit` };
  }
  if (a.riskScore >= r.autoSendMaxRisk) {
    return { auto: false, reason: `Needs your approval: risk ${a.riskScore} is at or above your auto-send limit of ${r.autoSendMaxRisk}` };
  }
  return {
    auto: true,
    reason: `Sent automatically under your rules: ${TONE_LABEL[a.tone]} tone, ${formatUsd(a.amountCents)} ≤ ${formatUsd(r.autoSendMaxAmountCents)}, risk ${a.riskScore} < ${r.autoSendMaxRisk}`,
  };
}
