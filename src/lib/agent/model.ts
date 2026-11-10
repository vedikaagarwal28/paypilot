import { createAnthropic } from '@ai-sdk/anthropic';
import type { LanguageModelV1 } from 'ai';
import { env } from '@/lib/env';

export function getModel(): LanguageModelV1 {
  const e = env();
  return createAnthropic({ apiKey: e.ANTHROPIC_API_KEY })(e.ANTHROPIC_MODEL);
}
