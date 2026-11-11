import { createAnthropic } from '@ai-sdk/anthropic';
import { createGoogleGenerativeAI } from '@ai-sdk/google';
import type { LanguageModelV1 } from 'ai';
import { env, type Env } from '@/lib/env';

/** Google Gemini (free tier) by default; set AI_PROVIDER=anthropic to use Claude instead. */
export function modelChoice(e: Pick<Env, 'AI_PROVIDER' | 'GEMINI_MODEL' | 'ANTHROPIC_MODEL'>): { provider: 'google' | 'anthropic'; modelId: string } {
  return e.AI_PROVIDER === 'anthropic'
    ? { provider: 'anthropic', modelId: e.ANTHROPIC_MODEL }
    : { provider: 'google', modelId: e.GEMINI_MODEL };
}

export function getModel(): LanguageModelV1 {
  const e = env();
  const { provider, modelId } = modelChoice(e);
  return provider === 'anthropic'
    ? createAnthropic({ apiKey: e.ANTHROPIC_API_KEY })(modelId)
    : createGoogleGenerativeAI({ apiKey: e.GOOGLE_GENERATIVE_AI_API_KEY })(modelId);
}
