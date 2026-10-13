import { readFileSync } from 'node:fs';
import { z } from 'zod';
import type { AiConfiguration } from './contracts.ts';

const endpoint = z
  .string()
  .url()
  .refine((value) => {
    const u = new URL(value);
    return (
      !u.username &&
      !u.password &&
      !u.search &&
      !u.hash &&
      (u.protocol === 'https:' ||
        (u.protocol === 'http:' && ['localhost', '127.0.0.1', '[::1]'].includes(u.hostname)))
    );
  }, 'Use HTTPS or a loopback HTTP gateway');
const profile = z
  .object({
    adapter: z.enum(['responses', 'chat-completions']),
    baseUrl: endpoint,
    apiKeyEnv: z.string().regex(/^[A-Z][A-Z0-9_]*$/),
    model: z.string().min(1).max(200),
    timeoutMs: z.number().int().min(100).max(90000).default(45000),
    maxOutputTokens: z.number().int().min(256).max(12000).default(4500),
    retries: z.number().int().min(0).max(1).default(0),
    temperature: z.number().min(0).max(2).optional(),
  })
  .strict();
const chain = z.array(z.string().min(1)).min(1).max(2);
const schema = z
  .object({
    profiles: z.record(profile),
    routes: z
      .object({
        context: chain,
        mechanics: chain,
        verification: chain,
        legal: chain.optional(),
        pro_review: chain.optional(),
      })
      .strict(),
  })
  .strict();
export function parseAiConfig(value: unknown): AiConfiguration {
  const parsed = schema.safeParse(value);
  if (!parsed.success) throw new Error('INVALID_AI_CONFIG');
  const routes = {
    ...parsed.data.routes,
    legal: parsed.data.routes.legal || parsed.data.routes.verification,
    pro_review: parsed.data.routes.pro_review || parsed.data.routes.verification,
  };
  for (const route of Object.values(routes)) {
    if (
      new Set(route).size !== route.length ||
      route.some((id) => !Object.hasOwn(parsed.data.profiles, id))
    )
      throw new Error('INVALID_AI_ROUTE');
  }
  return { ...parsed.data, routes };
}
export function loadAiConfig(env: NodeJS.ProcessEnv = process.env): AiConfiguration {
  if (env.AIGAK_AI_CONFIG) {
    try {
      return parseAiConfig(JSON.parse(readFileSync(env.AIGAK_AI_CONFIG, 'utf8')));
    } catch {
      throw new Error('INVALID_AI_CONFIG');
    }
  }
  return parseAiConfig({
    profiles: {
      default: {
        adapter: 'responses',
        baseUrl: 'https://api.openai.com/v1',
        apiKeyEnv: 'OPENAI_API_KEY',
        model: env.OPENAI_MODEL || 'gpt-4.1-mini',
      },
    },
    routes: { context: ['default'], mechanics: ['default'], verification: ['default'] },
  });
}
