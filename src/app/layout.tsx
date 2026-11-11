import type { Metadata } from 'next';
import { Geist, Geist_Mono } from 'next/font/google';
import { Nav } from '@/components/nav';
import { Toaster } from '@/components/ui/sonner';
import { demoOffsetDays } from '@/lib/clock';
import './globals.css';

const geistSans = Geist({ variable: '--font-geist-sans', subsets: ['latin'] });
const geistMono = Geist_Mono({ variable: '--font-geist-mono', subsets: ['latin'] });

export const metadata: Metadata = {
  title: 'PayPilot',
  description: 'AI collections and payout copilot for freelancers, built on PayPal.',
};

export const dynamic = 'force-dynamic';

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body className={`${geistSans.variable} ${geistMono.variable} min-h-screen bg-muted/30 font-sans antialiased`}>
        <Nav demoOffsetDays={demoOffsetDays()} />
        <main className="mx-auto max-w-6xl px-4 py-6">{children}</main>
        <Toaster richColors position="bottom-right" />
      </body>
    </html>
  );
}
