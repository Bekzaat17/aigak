import type { ModelGateway } from '../ai/contracts.ts';
import { AiError } from '../ai/contracts.ts';
import { legalOutputSchema } from '../ai/legal-schema.ts';
import { verifiedLegalAnalysis } from './verified-legal-analysis';
import { PROMPT_VERSION, prompts } from '../ai/prompts.ts';
import { outputSchema, parseAnalysis, SCHEMA_VERSION } from '../ai/schema.ts';
import type { AiAnalyzer } from './contracts.ts';
import { compactSources } from './compact-sources.ts';
import { taskContext } from './task-context';

/** Domain adapter: translates inspection data to a provider-independent gateway request. */
export class GatewayAnalyzer implements AiAnalyzer {
  constructor(private readonly gateway: ModelGateway) {}
  get available() {
    return this.gateway.available;
  }
  async analyze(
    evidence: Parameters<AiAnalyzer['analyze']>[0],
    options: Parameters<AiAnalyzer['analyze']>[1],
  ): ReturnType<AiAnalyzer['analyze']> {
    const task = options.task;
    const sources = evidence.filter((e) => e.text?.trim());
    const input = JSON.stringify({
      sources: compactSources(sources),
      osint: taskContext(task, options.osint),
      inspectorStatements: options.inspectorResponses?.length
        ? {
            notice:
              'Untrusted inspector statements, not primary evidence. Verify against sources; never cite statements as observed facts.',
            responses: options.inspectorResponses || [],
          }
        : undefined,
      candidates: options.candidates || [],
      previousStages: (options.previousStages || []).map((s) => ({
        id: s.id,
        status: s.status,
        summary: s.summary,
        // Candidates already contain merged observations; avoid sending repeated copies.
        review: s.review,
        legalHypotheses: s.legalHypotheses,
      })),
    });
    // Fail visibly rather than silently inspecting a truncated source.
    if (input.length > 180000) throw new AiError('AI_INPUT_TOO_LARGE');
    if (task === 'legal')
      return verifiedLegalAnalysis(
        this.gateway,
        { instructions: prompts.legal, input, schema: legalOutputSchema, schemaName: 'legal_v1' },
        options.osint?.legalNorms || [],
        options.candidates || [],
        options.signal,
        {
          beforeAttempt: options.beforeAttempt || (() => {}),
          onAttempt: options.onAttempt || (() => {}),
        },
      );
    return this.gateway.complete(
      task,
      { instructions: prompts[task], input, schema: outputSchema, schemaName: 'inspection_v2' },
      {
        promptVersion: task === 'pro_review' ? 'pro-review/1.5.0' : PROMPT_VERSION,
        schemaVersion: SCHEMA_VERSION,
      },
      options.signal,
      {
        beforeAttempt: options.beforeAttempt || (() => {}),
        onAttempt: options.onAttempt || (() => {}),
      },
      (text) => parseAnalysis(text, sources),
    );
  }
}
