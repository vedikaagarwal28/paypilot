import { z } from 'zod';

export const toneSchema = z.enum(['gentle', 'friendly_firm', 'firm']);

export const rulesSchema = z.object({
  autoSendMaxAmountCents: z.number().int().min(0).max(10_000_000),
  autoSendMaxRisk: z.number().int().min(0).max(100),
  autoSendTones: z.array(toneSchema),
  autoSendInvoices: z.boolean(),
});

export const collaboratorSchema = z.object({
  name: z.string().trim().min(1).max(60),
  role: z.string().trim().max(40).default(''),
  paypalEmail: z.string().trim().email(),
  defaultPercent: z.number().int().min(1).max(100),
});

export const splitsSchema = z
  .array(z.object({ collaboratorId: z.number().int().positive(), percent: z.number().int().min(1).max(100) }))
  .refine((s) => new Set(s.map((x) => x.collaboratorId)).size === s.length, { message: 'Each collaborator can appear only once' })
  .refine((s) => s.reduce((sum, x) => sum + x.percent, 0) <= 100, { message: 'Splits add up to more than 100%' });
