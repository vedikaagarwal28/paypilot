import { z } from 'zod';

const csv = z.string().default('').transform((s) => s.split(',').map((x) => x.trim()).filter(Boolean));

const schema = z.object({
  PAYPAL_CLIENT_ID: z.string().min(1),
  PAYPAL_CLIENT_SECRET: z.string().min(1),
  PAYPAL_WEBHOOK_ID: z.string().default(''),
  PAYPAL_API_BASE: z.string().url().default('https://api-m.sandbox.paypal.com'),
  PAYPAL_WEBHOOK_SKIP_VERIFY: z.enum(['true', 'false']).default('false'),
  AI_PROVIDER: z.enum(['google', 'anthropic']).default('google'),
  GOOGLE_GENERATIVE_AI_API_KEY: z.string().default(''),
  GEMINI_MODEL: z.string().default('gemini-2.5-flash'),
  ANTHROPIC_API_KEY: z.string().default(''),
  ANTHROPIC_MODEL: z.string().default('claude-sonnet-5-5'),
  DATABASE_URL: z.string().min(1),
  RESEND_API_KEY: z.string().default(''),
  RESEND_FROM: z.string().default('PayPilot <onboarding@resend.dev>'),
  DEMO_INBOX_EMAIL: z.string().default(''),
  SANDBOX_BUYER_EMAILS: csv,
  SANDBOX_COLLAB_EMAILS: csv,
  DEMO_CLOCK_OFFSET_DAYS: z.coerce.number().int().default(0),
  DEMO_PAY_MODE: z.enum(['buyer', 'record']).default('buyer'),
  APP_URL: z.string().default('http://localhost:3000'),
});

export type Env = z.infer<typeof schema>;

let cached: Env | null = null;

/** Parsed lazily so `next build` works without secrets present. */
export function env(): Env {
  if (!cached) cached = schema.parse(process.env);
  return cached;
}
