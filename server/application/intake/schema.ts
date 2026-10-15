import { z } from 'zod';
export const intake = z.object({
  authProfileId: z
    .string()
    .regex(/^[a-z0-9_-]{1,60}$/)
    .optional(),
  authMode: z.enum(['login', 'register']).optional(),
  title: z.string().trim().min(1).max(160),
  sourceType: z.enum(['url', 'file', 'text']),
  sourceUrl: z.string().max(2048).optional(),
  text: z.string().max(180000).optional(),
  useAi: z.enum(['true', 'false']).default('false'),
  analysisLevel: z.enum(['basic', 'advanced', 'pro']).optional(),
  templateId: z.string().default('builtin'),
});
