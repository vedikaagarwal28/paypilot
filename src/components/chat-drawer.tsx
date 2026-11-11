'use client';

import { useChat } from 'ai/react';
import { Loader2Icon, SendIcon, SparklesIcon } from 'lucide-react';
import { useEffect, useRef } from 'react';
import { useSWRConfig } from 'swr';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet';

const SUGGESTIONS = [
  'Which clients are most likely to pay late?',
  'Draft a firm but friendly reminder for Acme',
  'Invoice Brightline $1,200 for logo work, due in 15 days, split 30% to Maya',
];

type ToolPart = { toolName: string; state: string; result?: Record<string, unknown> };

function toolChip(t: ToolPart): string {
  const r = t.result ?? {};
  if (t.state !== 'result') return `⏳ ${t.toolName.replaceAll('_', ' ')}…`;
  if (typeof r.error === 'string') return `⚠️ ${r.error}`;
  switch (t.toolName) {
    case 'draft_reminder':
      return r.status === 'sent' ? `📨 Reminder sent to ${r.invoice} under your rules` : `📝 Drafted reminder for ${r.invoice}: waiting for your approval`;
    case 'create_invoice':
      return r.status === 'sent' ? `🧾 Invoice ${r.invoiceNumber} sent` : `🧾 Created draft ${r.invoiceNumber}: waiting for your approval`;
    case 'get_risk_report':
      return '📊 Checked risk on open invoices';
    case 'get_cashflow':
      return '💵 Checked cash flow';
    case 'get_client_profile':
      return '👤 Looked up client history';
    case 'list_pending_actions':
      return '🗂️ Checked the approval queue';
    default:
      return `🔎 PayPal: ${t.toolName.replaceAll('_', ' ')}`;
  }
}

export function ChatDrawer({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const { mutate } = useSWRConfig();
  const { messages, input, handleInputChange, handleSubmit, append, status, error } = useChat({
    api: '/api/chat',
    // Tools can queue or send actions: refresh every open view when a reply finishes.
    onFinish: () => mutate(() => true),
  });
  const bottom = useRef<HTMLDivElement>(null);
  const busy = status === 'submitted' || status === 'streaming';

  useEffect(() => bottom.current?.scrollIntoView({ behavior: 'smooth' }), [messages]);

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="flex w-full flex-col gap-0 p-0 sm:max-w-md">
        <SheetHeader className="border-b">
          <SheetTitle className="flex items-center gap-2"><SparklesIcon className="size-4" /> PayPilot Copilot</SheetTitle>
          <SheetDescription>Ask about late payers, draft reminders or create invoices. Anything that sends follows your autopilot rules.</SheetDescription>
        </SheetHeader>

        <div className="flex-1 space-y-4 overflow-y-auto p-4">
          {messages.length === 0 && (
            <div className="space-y-2">
              <p className="text-sm text-muted-foreground">Try:</p>
              {SUGGESTIONS.map((s) => (
                <button key={s} onClick={() => append({ role: 'user', content: s })} className="block w-full rounded-lg border px-3 py-2 text-left text-sm hover:bg-muted">
                  {s}
                </button>
              ))}
            </div>
          )}
          {messages.map((m) => (
            <div key={m.id} className={m.role === 'user' ? 'ml-8 rounded-lg bg-primary px-3 py-2 text-sm text-primary-foreground' : 'mr-4 space-y-2 text-sm'}>
              {m.parts?.map((p, i) => {
                if (p.type === 'text') return <p key={i} className="whitespace-pre-wrap leading-relaxed">{p.text}</p>;
                if (p.type === 'tool-invocation') {
                  return (
                    <div key={i} className="rounded-md border bg-muted/50 px-2 py-1 text-xs text-muted-foreground">
                      {toolChip(p.toolInvocation as unknown as ToolPart)}
                    </div>
                  );
                }
                return null;
              }) ?? <p className="whitespace-pre-wrap">{m.content}</p>}
            </div>
          ))}
          {busy && <Loader2Icon className="size-4 animate-spin text-muted-foreground" />}
          {error && <p className="text-sm text-destructive">{error.message}</p>}
          <div ref={bottom} />
        </div>

        <form onSubmit={handleSubmit} className="flex gap-2 border-t p-3">
          <Input value={input} onChange={handleInputChange} placeholder="Ask PayPilot…" disabled={busy} />
          <Button type="submit" size="icon" disabled={busy || !input.trim()} aria-label="Send">
            <SendIcon />
          </Button>
        </form>
      </SheetContent>
    </Sheet>
  );
}
