export type Tone = 'gentle' | 'friendly_firm' | 'firm';
export type ActionType = 'send_reminder' | 'send_invoice';
export type ActionStatus = 'queued' | 'executing' | 'sent' | 'skipped' | 'failed';
export type Actor = 'agent' | 'rule' | 'user' | 'paypal' | 'system';

export interface RiskFeatures {
  daysOverdue: number;
  avgDaysLate: number;
  pctPaidLate: number;
  ignoredReminders: number;
  amountRatio: number;
  remindersOnInvoice: number;
}

export interface RiskFactor {
  label: string;
  points: number;
}

export interface RiskResult {
  score: number;
  tone: Tone;
  factors: RiskFactor[];
}

export interface Rules {
  autoSendMaxAmountCents: number;
  autoSendMaxRisk: number;
  autoSendTones: Tone[];
  autoSendInvoices: boolean;
}

export const DEFAULT_RULES: Rules = {
  autoSendMaxAmountCents: 50000,
  autoSendMaxRisk: 40,
  autoSendTones: ['gentle'],
  autoSendInvoices: false,
};

export interface TriageSummary {
  open: number;
  needsAttention: number;
  autoSent: number;
  queued: number;
  skippedRecent: number;
}

export const TONE_LABEL: Record<Tone, string> = {
  gentle: 'gentle',
  friendly_firm: 'friendly-firm',
  firm: 'firm',
};
