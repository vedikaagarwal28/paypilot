'use client';

import { PlaneTakeoffIcon, SparklesIcon } from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState } from 'react';
import { DemoBadge } from '@/components/badges';
import { ChatDrawer } from '@/components/chat-drawer';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

const LINKS = [
  { href: '/', label: 'Today' },
  { href: '/invoices', label: 'Invoices' },
  { href: '/cashflow', label: 'Cash flow' },
  { href: '/activity', label: 'Activity' },
  { href: '/settings', label: 'Settings' },
];

export function Nav({ demoOffsetDays, paypalSimulated }: { demoOffsetDays: number; paypalSimulated: boolean }) {
  const pathname = usePathname();
  const [chatOpen, setChatOpen] = useState(false);

  return (
    <header className="sticky top-0 z-40 border-b bg-background/90 backdrop-blur">
      <div className="mx-auto flex h-14 max-w-6xl items-center gap-4 px-4">
        <Link href="/" className="flex items-center gap-2 font-semibold">
          <PlaneTakeoffIcon className="size-5 text-sky-600" />
          PayPilot
        </Link>
        <nav className="hidden gap-1 md:flex">
          {LINKS.map((l) => {
            const active = l.href === '/' ? pathname === '/' : pathname.startsWith(l.href);
            return (
              <Link key={l.href} href={l.href} className={cn('rounded-md px-3 py-1.5 text-sm', active ? 'bg-muted font-medium' : 'text-muted-foreground hover:text-foreground')}>
                {l.label}
              </Link>
            );
          })}
        </nav>
        <div className="ml-auto flex items-center gap-2">
          <DemoBadge />
          {demoOffsetDays > 0 && <DemoBadge>Demo time +{demoOffsetDays}d</DemoBadge>}
          {paypalSimulated ? (
            <span className="hidden rounded-full bg-amber-50 px-2 py-0.5 text-[11px] font-medium text-amber-800 sm:inline dark:bg-amber-950 dark:text-amber-300" title="PAYPAL_API_BASE points at a simulated PayPal API, not PayPal">PayPal simulated</span>
          ) : (
            <span className="hidden rounded-full bg-sky-50 px-2 py-0.5 text-[11px] font-medium text-sky-700 sm:inline dark:bg-sky-950 dark:text-sky-300">PayPal sandbox</span>
          )}
          <Button size="sm" onClick={() => setChatOpen(true)}>
            <SparklesIcon /> Copilot
          </Button>
        </div>
      </div>
      <nav className="flex gap-1 overflow-x-auto px-4 pb-2 md:hidden">
        {LINKS.map((l) => (
          <Link key={l.href} href={l.href} className={cn('shrink-0 rounded-md px-3 py-1 text-sm', pathname === l.href ? 'bg-muted font-medium' : 'text-muted-foreground')}>
            {l.label}
          </Link>
        ))}
      </nav>
      <ChatDrawer open={chatOpen} onOpenChange={setChatOpen} />
    </header>
  );
}
