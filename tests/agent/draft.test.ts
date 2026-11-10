import { expect, test } from 'vitest';
import { MockLanguageModelV1 } from 'ai/test';
import { draftReminder, fallbackDraft, type DraftContext } from '@/lib/agent/draft';

const ctx: DraftContext = {
  clientName: 'Acme Corp',
  invoiceNumber: 'PP1-3',
  description: 'Website redesign — milestone 2',
  amountCents: 180000,
  dueDate: '2026-10-22',
  daysOverdue: 20,
  tone: 'firm',
  factors: [{ label: 'Overdue 20 days', points: 23.3 }, { label: 'Pays 15 days late on average', points: 18.8 }],
  historyNote: 'Paid 4 of 5 invoices late',
  remindersSent: 0,
};

test('falls back when model throws', async () => {
  const model = new MockLanguageModelV1({ doGenerate: async () => { throw new Error('down'); } });
  const d = await draftReminder(ctx, { model });
  expect(d.usedFallback).toBe(true);
  expect(d.body).toContain('PP1-3');
  expect(d.body).toContain('$1,800.00');
  expect(d.body).toContain('20 days');
});

test('uses model output when valid', async () => {
  const model = new MockLanguageModelV1({
    defaultObjectGenerationMode: 'json',
    doGenerate: async () => ({
      rawCall: { rawPrompt: null, rawSettings: {} },
      finishReason: 'stop',
      usage: { promptTokens: 10, completionTokens: 10 },
      text: JSON.stringify({ subject: 'S', body: 'B', explanation: 'E' }),
    }),
  });
  expect(await draftReminder(ctx, { model })).toEqual({ subject: 'S', body: 'B', explanation: 'E', usedFallback: false });
});

test('falls back when model returns junk', async () => {
  const model = new MockLanguageModelV1({
    defaultObjectGenerationMode: 'json',
    doGenerate: async () => ({
      rawCall: { rawPrompt: null, rawSettings: {} },
      finishReason: 'stop',
      usage: { promptTokens: 10, completionTokens: 10 },
      text: 'not json at all',
    }),
  });
  expect((await draftReminder(ctx, { model })).usedFallback).toBe(true);
});

test('fallback explanation cites top factor', () => {
  expect(fallbackDraft({ ...ctx, tone: 'gentle' }).explanation).toContain('Overdue 20 days');
});

test('fallback tones differ', () => {
  expect(fallbackDraft({ ...ctx, tone: 'gentle' }).body).not.toEqual(fallbackDraft({ ...ctx, tone: 'firm' }).body);
});
