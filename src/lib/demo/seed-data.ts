/**
 * The demo world. Client histories are synthetic ("Demo data" in the UI); invoices are created for real
 * in the PayPal sandbox. Values are tuned so the risk scorer and policy gate produce the scripted demo:
 * Brightline auto-sends, Orbit/Acme/Kestrel queue, Juniper is not yet due, Tallpine is already paid.
 */

export interface SeedClient {
  name: string;
  buyerIndex: number;
  avgDaysLate: number;
  pctPaidLate: number;
  ignoredReminders: number;
  typicalAmountCents: number;
  historyNote: string;
}

export interface SeedInvoice {
  clientIndex: number;
  description: string;
  amountCents: number;
  dueInDays: number;
  remindersSent: number;
  lastReminderDaysAgo?: number;
  paid?: { daysAgo: number };
  splits: { collaboratorIndex: number; percent: number }[];
}

export const SEED_CLIENTS: SeedClient[] = [
  { name: 'Brightline Studio', buyerIndex: 0, avgDaysLate: 1, pctPaidLate: 0.1, ignoredReminders: 0, typicalAmountCents: 43750, historyNote: 'Usually pays within a day of the due date' },
  { name: 'Orbit Coffee', buyerIndex: 1, avgDaysLate: 6, pctPaidLate: 0.4, ignoredReminders: 1, typicalAmountCents: 65000, historyNote: 'Paid 2 of 5 invoices late' },
  { name: 'Acme Corp', buyerIndex: 2, avgDaysLate: 15, pctPaidLate: 0.8, ignoredReminders: 2, typicalAmountCents: 180000, historyNote: 'Paid 4 of 5 invoices late, ignored 2 reminders' },
  { name: 'Kestrel Labs', buyerIndex: 0, avgDaysLate: 20, pctPaidLate: 1.0, ignoredReminders: 3, typicalAmountCents: 120000, historyNote: 'Every invoice late; ignored 3 reminders' },
  { name: 'Juniper & Co', buyerIndex: 1, avgDaysLate: 2, pctPaidLate: 0.2, ignoredReminders: 0, typicalAmountCents: 90000, historyNote: 'Reliable' },
  { name: 'Tallpine Media', buyerIndex: 2, avgDaysLate: 3, pctPaidLate: 0.25, ignoredReminders: 0, typicalAmountCents: 120000, historyNote: 'Reliable' },
];

export const SEED_COLLABORATORS = [
  { name: 'Maya Chen', role: 'Designer', collabIndex: 0, defaultPercent: 30 },
  { name: 'Leo Park', role: 'Copywriter', collabIndex: 1, defaultPercent: 20 },
];

export const SEED_INVOICES: SeedInvoice[] = [
  { clientIndex: 0, description: 'Brand refresh — round 2', amountCents: 35000, dueInDays: -3, remindersSent: 0, splits: [] },
  { clientIndex: 1, description: 'Menu design', amountCents: 65000, dueInDays: -8, remindersSent: 0, splits: [] },
  { clientIndex: 2, description: 'Website redesign — milestone 2', amountCents: 180000, dueInDays: -20, remindersSent: 0, splits: [{ collaboratorIndex: 0, percent: 30 }, { collaboratorIndex: 1, percent: 20 }] },
  { clientIndex: 3, description: 'Product launch landing page', amountCents: 240000, dueInDays: -30, remindersSent: 1, lastReminderDaysAgo: 7, splits: [] },
  { clientIndex: 4, description: 'Social media kit', amountCents: 90000, dueInDays: 10, remindersSent: 0, splits: [{ collaboratorIndex: 0, percent: 30 }] },
  { clientIndex: 5, description: 'Podcast artwork', amountCents: 120000, dueInDays: -5, remindersSent: 0, paid: { daysAgo: 2 }, splits: [] },
];
