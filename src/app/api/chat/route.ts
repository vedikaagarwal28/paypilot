import { streamText, type Message } from 'ai';
import { getModel } from '@/lib/agent/model';
import { SYSTEM_PROMPT } from '@/lib/agent/system-prompt';
import { buildTools } from '@/lib/agent/tools';

export const dynamic = 'force-dynamic';
export const maxDuration = 120;

export async function POST(req: Request) {
  const { messages } = (await req.json()) as { messages: Message[] };
  const result = streamText({
    model: getModel(),
    system: SYSTEM_PROMPT,
    messages,
    tools: buildTools(),
    maxSteps: 6,
  });
  return result.toDataStreamResponse({
    getErrorMessage: (e) => (e instanceof Error ? e.message : 'Something went wrong'),
  });
}
