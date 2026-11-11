import {
  boolean, date, integer, jsonb, pgTable, real, serial, text, timestamp, unique, uniqueIndex,
} from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';
import type { RiskFactor, Rules } from '@/lib/types';

const ts = (name: string) => timestamp(name, { withTimezone: true });

export const clients = pgTable('clients', {
  id: serial('id').primaryKey(),
  name: text('name').notNull(),
  paypalEmail: text('paypal_email').notNull(),
  contactEmail: text('contact_email').notNull(),
  avgDaysLate: integer('avg_days_late').notNull().default(0),
  pctPaidLate: real('pct_paid_late').notNull().default(0),
  ignoredReminders: integer('ignored_reminders').notNull().default(0),
  typicalAmountCents: integer('typical_amount_cents').notNull().default(0),
  historyNote: text('history_note').notNull().default(''),
});

export const invoices = pgTable('invoices', {
  id: serial('id').primaryKey(),
  paypalId: text('paypal_id').notNull().unique(),
  number: text('number').notNull().unique(),
  clientId: integer('client_id').notNull().references(() => clients.id),
  amountCents: integer('amount_cents').notNull(),
  description: text('description').notNull().default(''),
  issueDate: date('issue_date').notNull(),
  dueDate: date('due_date').notNull(),
  status: text('status').notNull(),
  riskScore: integer('risk_score'),
  riskTone: text('risk_tone'),
  riskFactors: jsonb('risk_factors').$type<RiskFactor[]>(),
  riskExplanation: text('risk_explanation'),
  remindersSent: integer('reminders_sent').notNull().default(0),
  lastReminderAt: ts('last_reminder_at'),
  paidAt: ts('paid_at'),
  demoBatch: text('demo_batch').notNull(),
  payerViewUrl: text('payer_view_url'),
  updatedAt: ts('updated_at').notNull().defaultNow(),
});

export const collaborators = pgTable('collaborators', {
  id: serial('id').primaryKey(),
  name: text('name').notNull(),
  role: text('role').notNull().default(''),
  paypalEmail: text('paypal_email').notNull(),
  defaultPercent: integer('default_percent').notNull().default(0),
});

export const splits = pgTable('splits', {
  id: serial('id').primaryKey(),
  invoiceId: integer('invoice_id').notNull().references(() => invoices.id, { onDelete: 'cascade' }),
  collaboratorId: integer('collaborator_id').notNull().references(() => collaborators.id),
  percent: integer('percent').notNull(),
}, (t) => [unique('splits_invoice_collaborator').on(t.invoiceId, t.collaboratorId)]);

export const pendingActions = pgTable('pending_actions', {
  id: serial('id').primaryKey(),
  type: text('type').notNull(),
  invoiceId: integer('invoice_id').notNull().references(() => invoices.id, { onDelete: 'cascade' }),
  tone: text('tone'),
  subject: text('subject'),
  body: text('body'),
  reason: text('reason').notNull(),
  gateReason: text('gate_reason').notNull().default(''),
  usedFallback: boolean('used_fallback').notNull().default(false),
  status: text('status').notNull().default('queued'),
  decidedBy: text('decided_by'),
  error: text('error'),
  createdAt: ts('created_at').notNull().defaultNow(),
  decidedAt: ts('decided_at'),
}, (t) => [
  // At most one open action per invoice, so overlapping agent runs can't double-queue or double-send.
  uniqueIndex('pending_actions_one_open_per_invoice').on(t.invoiceId).where(sql`status in ('queued', 'executing')`),
]);

export const payouts = pgTable('payouts', {
  id: serial('id').primaryKey(),
  invoiceId: integer('invoice_id').notNull().references(() => invoices.id, { onDelete: 'cascade' }),
  collaboratorId: integer('collaborator_id').notNull().references(() => collaborators.id),
  amountCents: integer('amount_cents').notNull(),
  senderBatchId: text('sender_batch_id').notNull(),
  payoutBatchId: text('payout_batch_id'),
  senderItemId: text('sender_item_id').notNull().unique(),
  status: text('status').notNull().default('PENDING'),
  createdAt: ts('created_at').notNull().defaultNow(),
}, (t) => [unique('payouts_invoice_collaborator').on(t.invoiceId, t.collaboratorId)]);

export const activity = pgTable('activity', {
  id: serial('id').primaryKey(),
  at: ts('at').notNull().defaultNow(),
  actor: text('actor').notNull(),
  action: text('action').notNull(),
  summary: text('summary').notNull(),
  reason: text('reason'),
  invoiceId: integer('invoice_id'),
  payload: jsonb('payload'),
});

export const settings = pgTable('settings', {
  id: integer('id').primaryKey(),
  rules: jsonb('rules').$type<Rules>().notNull(),
  demoBatch: text('demo_batch'),
  lastResetAt: ts('last_reset_at'),
});

export const agentRuns = pgTable('agent_runs', {
  id: serial('id').primaryKey(),
  startedAt: ts('started_at').notNull().defaultNow(),
  finishedAt: ts('finished_at'),
  summary: jsonb('summary'),
});
