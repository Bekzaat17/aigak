import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import type { Evidence } from '../../shared/types.ts';
import { AiError } from './contracts.ts';
export const SCHEMA_VERSION = 'inspection/2.1.0';
const bi = z.object({ ru: z.string().min(1).max(1500), kk: z.string().min(1).max(1500) }).strict();
const quote = { evidenceId: z.string().min(1), quote: z.string().min(3).max(1000) };
const schema = z
  .object({
    likelihood: z.number().int().min(0).max(100),
    assessment: bi,
    findings: z
      .array(
        z
          .object({
            ...quote,
            category: z.enum(['gambling', 'incentive', 'payment', 'bet']),
            title: bi,
            explanation: bi,
          })
          .strict(),
      )
      .max(12),
    review: z
      .object({
        status: z.enum(['indicators', 'ambiguous', 'insufficient', 'not_found']),
        uncertainties: z.array(bi).max(8),
        questions: z.array(bi).max(5),
        contradictions: z.array(z.object({ ...quote, explanation: bi }).strict()).max(8),
      })
      .strict(),
  })
  .strict();
const bilingual = {
  type: 'object',
  properties: { ru: { type: 'string' }, kk: { type: 'string' } },
  required: ['ru', 'kk'],
  additionalProperties: false,
};
const reference = { evidenceId: { type: 'string' }, quote: { type: 'string' } };
export const outputSchema = {
  type: 'object',
  properties: {
    likelihood: {
      type: 'integer',
      minimum: 0,
      maximum: 100,
      description:
        'Whole percentage points from 0 to 100. For example 99 means 99 percent; never return a 0-to-1 fraction.',
    },
    assessment: bilingual,
    findings: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          ...reference,
          category: { type: 'string', enum: ['gambling', 'incentive', 'payment', 'bet'] },
          title: bilingual,
          explanation: bilingual,
        },
        required: ['evidenceId', 'quote', 'category', 'title', 'explanation'],
        additionalProperties: false,
      },
    },
    review: {
      type: 'object',
      properties: {
        status: { type: 'string', enum: ['indicators', 'ambiguous', 'insufficient', 'not_found'] },
        uncertainties: { type: 'array', items: bilingual },
        questions: { type: 'array', items: bilingual },
        contradictions: {
          type: 'array',
          items: {
            type: 'object',
            properties: { ...reference, explanation: bilingual },
            required: ['evidenceId', 'quote', 'explanation'],
            additionalProperties: false,
          },
        },
      },
      required: ['status', 'uncertainties', 'questions', 'contradictions'],
      additionalProperties: false,
    },
  },
  required: ['likelihood', 'assessment', 'findings', 'review'],
  additionalProperties: false,
};
export function parseAnalysis(text: string, evidence: Evidence[]) {
  let parsed: z.infer<typeof schema>;
  try {
    parsed = schema.parse(JSON.parse(text));
  } catch {
    throw new AiError('AI_INVALID_RESPONSE');
  }
  const locate = (ref: { evidenceId: string; quote: string }) => {
    const start = evidence.find((e) => e.id === ref.evidenceId)?.text?.indexOf(ref.quote) ?? -1;
    if (start < 0) throw new AiError('AI_UNGROUNDED');
    return start;
  };
  for (const ref of parsed.review.contradictions) locate(ref);
  return {
    ...parsed,
    findings: parsed.findings.map((f) => {
      const start = locate(f);
      return {
        ...f,
        id: randomUUID(),
        start,
        end: start + f.quote.length,
        engine: 'ai' as const,
        decision: 'pending' as const,
      };
    }),
  };
}
