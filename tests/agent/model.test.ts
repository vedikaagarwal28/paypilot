import { expect, test } from 'vitest';
import { modelChoice } from '@/lib/agent/model';

test('defaults to the free Gemini model', () => {
  expect(modelChoice({ AI_PROVIDER: 'google', GEMINI_MODEL: 'gemini-2.5-flash', ANTHROPIC_MODEL: 'claude-sonnet-5-5' }))
    .toEqual({ provider: 'google', modelId: 'gemini-2.5-flash' });
});

test('switches to Claude when AI_PROVIDER=anthropic', () => {
  expect(modelChoice({ AI_PROVIDER: 'anthropic', GEMINI_MODEL: 'gemini-2.5-flash', ANTHROPIC_MODEL: 'claude-sonnet-5-5' }))
    .toEqual({ provider: 'anthropic', modelId: 'claude-sonnet-5-5' });
});
