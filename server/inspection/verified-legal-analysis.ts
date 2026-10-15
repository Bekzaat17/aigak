import { legalCitations, resolveLegalCitations } from '../ai/legal-citations';
import {
  AiError,
  type ModelGateway,
  type ModelRequest,
  type AttemptObserver,
} from '../ai/contracts';
import { legalOutputSchema, parseLegal } from '../ai/legal-schema';
import { legalRepair } from '../ai/prompts/legal-repair';
import type { LegalNorm } from '../../shared/osint';
import type { Finding } from '../../shared/types';
/** One explicit repair with identical source material. Validation is never relaxed. */
export async function verifiedLegalAnalysis(
  gateway: ModelGateway,
  request: ModelRequest,
  norms: LegalNorm[],
  findings: Finding[],
  signal: AbortSignal,
  observer: AttemptObserver,
) {
  let rejectedAnswer = '';
  const citations = legalCitations(norms);
  const original: Record<string, unknown> = JSON.parse(request.input);
  const originalOsint = original.osint as Record<string, unknown> | undefined;
  const input = JSON.stringify({
    ...original,
    osint: {
      ...originalOsint,
      legalNorms: norms.map(({ quote: _quote, ...norm }) => {
        void _quote;
        return {
          ...norm,
          passages: citations
            .filter((c) => c.normId === norm.id)
            .map(({ id, text }) => ({ id, text })),
        };
      }),
    },
  });
  const { normQuote: _quoteSchema, ...properties } =
    legalOutputSchema.properties.hypotheses.items.properties;
  void _quoteSchema;

  const schema = {
    ...legalOutputSchema,
    properties: {
      ...legalOutputSchema.properties,
      hypotheses: {
        ...legalOutputSchema.properties.hypotheses,
        maxItems: findings.length ? 6 : 0,
        items: {
          ...legalOutputSchema.properties.hypotheses.items,
          required: legalOutputSchema.properties.hypotheses.items.required.map((k) =>
            k === 'normQuote' ? 'citationId' : k,
          ),
          properties: {
            ...properties,
            citationId: {
              type: 'string',
              ...(citations.length
                ? { enum: citations.filter((c) => c.text.length >= 3).map((c) => c.id) }
                : {}),
            },
            normId: { type: 'string', enum: norms.map((n) => n.id) },
            findingIds: {
              type: 'array',
              minItems: 1,
              items: {
                type: 'string',
                ...(findings.length ? { enum: findings.map((f) => f.id) } : {}),
              },
            },
          },
        },
      },
    },
  };
  const execute = (repair: boolean) =>
    gateway.complete(
      'legal',
      {
        ...request,
        schema,
        instructions: request.instructions + (repair ? legalRepair : ''),
        input: repair
          ? JSON.stringify({ originalInput: JSON.parse(input), rejectedAnswer })
          : input,
      },
      {
        promptVersion: repair ? 'legal-repair/2.0.0' : 'legal/1.8.0',
        schemaVersion: 'legal/1.2.0',
      },
      signal,
      observer,
      (text) => {
        rejectedAnswer = text;
        return parseLegal(resolveLegalCitations(text, citations), norms, findings);
      },
    );
  try {
    return await execute(false);
  } catch (error) {
    if (
      !(error instanceof AiError) ||
      error.code !== 'AI_UNGROUNDED' ||
      signal.aborted ||
      !rejectedAnswer
    )
      throw error;
    return execute(true);
  }
}
