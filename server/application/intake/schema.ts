import { z } from 'zod';
export const intake = z.object({
  title: z.string().trim().min(1).max(160),
  sourceType: z.enum(['url', 'file', 'text']),
  sourceUrl: z.string().max(2048).optional(),
  text: z.string().max(180000).optional(),
  useAi: z.enum(['true', 'false']).default('false'),
  analysisLevel: z.enum(['basic', 'advanced', 'pro']).optional(),
  templateId: z.string().default('builtin'),
});
