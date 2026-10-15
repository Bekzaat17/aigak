import { z } from 'zod';
import type { LegalNorm } from '../../shared/osint.ts';
import type { Finding } from '../../shared/types.ts';
import { AiError } from './contracts.ts';
const bi = z.object({ ru: z.string().min(1).max(1500), kk: z.string().min(1).max(1500) }).strict();
const schema = z
  .object({
    assessment: bi,
    hypotheses: z
      .array(
        z
          .object({
            normId: z.string(),
            normQuote: z.string().min(3).max(1500),
            findingIds: z.array(z.string()).min(1).max(12),
            reason: bi,
            missing: z.array(bi).min(1).max(6),
          })
          .strict(),
      )
      .max(6),
  })
  .strict();
const bilingual = {
  type: 'object',
  properties: { ru: { type: 'string' }, kk: { type: 'string' } },
  required: ['ru', 'kk'],
  additionalProperties: false,
};
export const legalOutputSchema = {
  type: 'object',
  properties: {
    assessment: bilingual,
    hypotheses: {
      type: 'array',
      maxItems: 6,
      items: {
        type: 'object',
        properties: {
          normId: { type: 'string' },
          normQuote: { type: 'string', minLength: 3, maxLength: 600 },
          findingIds: { type: 'array', items: { type: 'string' } },
          reason: bilingual,
          missing: { type: 'array', minItems: 1, maxItems: 3, items: bilingual },
        },
        required: ['normId', 'normQuote', 'findingIds', 'reason', 'missing'],
        additionalProperties: false,
      },
    },
  },
  required: ['assessment', 'hypotheses'],
  additionalProperties: false,
};
export function parseLegal(text: string, norms: LegalNorm[], findings: Finding[]) {
  let parsed: z.infer<typeof schema>;
  try {
    parsed = schema.parse(JSON.parse(text));
  } catch {
    throw new AiError('AI_INVALID_RESPONSE');
  }
  for (const h of parsed.hypotheses) {
    if (
      !norms.some((n) => n.id === h.normId && n.quote.includes(h.normQuote)) ||
      h.findingIds.some((id) => !findings.some((f) => f.id === id))
    )
      throw new AiError('AI_UNGROUNDED');
  }
  return {
    findings: [],
    likelihood: 0,
    assessment: parsed.assessment,
    legalHypotheses: parsed.hypotheses,
  };
}
