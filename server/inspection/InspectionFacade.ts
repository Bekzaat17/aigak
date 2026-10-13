import type { AiAttempt, Finding, InspectionStage, Localized } from '../../shared/types.ts';
import type { AiTask } from '../ai/contracts.ts';
import { rulesAssessment } from './checks.ts';
import type {
  AiAnalyzer,
  CheckResolver,
  CheckResult,
  InspectionInput,
  InspectionResult,
  ProgressObserver,
  StrategyResolver,
} from './contracts.ts';

function validateFindings(findings: Finding[], input: InspectionInput) {
  for (const f of findings) {
    const e = input.evidence.find((e) => e.id === f.evidenceId);
    if (!f.quote || !e?.text || e.text.slice(f.start, f.end) !== f.quote)
      throw new Error('UNGROUNDED_FINDING');
  }
}
function mergeFindings(existing: Finding[], incoming: Finding[], agentId: string): Finding[] {
  const result = structuredClone(existing);
  for (const finding of incoming) {
    const same = result.find(
      (f) =>
        f.evidenceId === finding.evidenceId &&
        f.category === finding.category &&
        f.quote === finding.quote &&
        f.rule?.id === finding.rule?.id,
    );
    if (same) same.agentIds = [...new Set([...(same.agentIds || []), agentId])];
    else result.push({ ...finding, decision: 'pending', agentIds: [agentId] });
  }
  return result;
}
/** Facade owns execution, resource limits and validation; it knows no concrete check classes. */
export class InspectionFacade {
  constructor(
    private readonly registry: CheckResolver,
    private readonly strategies: StrategyResolver,
    private readonly ai: AiAnalyzer,
  ) {}
  async inspect(
    input: InspectionInput,
    onStage: ProgressObserver = () => {},
    onStart: (stage: { id: string; name: Localized }) => void = () => {},
  ): Promise<InspectionResult> {
    const strategy = this.strategies.create(input.analysisLevel);
    // Resolve all configuration up front: unknown plugins are deployment errors, not partial success.
    const checks = strategy.checks.map((id) => this.registry.create(id));
    const startedAt = new Date().toISOString();
    const controller = new AbortController();
    const timer = setTimeout(
      () => controller.abort(new Error('ANALYSIS_TIMEOUT')),
      strategy.timeoutMs,
    );
    const stages: InspectionStage[] = [];
    const issues: Localized[] = [];
    let findings: Finding[] = [];
    let likelihood: number | null = null;
    let assessment = rulesAssessment(0);
    let aiCalls = 0;
    let successfulAi = 0;
    let attempts = 0;
    const hasText = input.evidence.some((e) => e.text?.trim());
    try {
      for (const check of checks) {
        onStart({ id: check.id, name: check.name });
        const aiAttempts: AiAttempt[] = [];
        const start = Date.now();
        let result: CheckResult | undefined;
        let errorCode: string | undefined;
        try {
          if (controller.signal.aborted) throw new Error('ANALYSIS_TIMEOUT');
          if (check.requiresAi && !hasText)
            result = {
              status: 'skipped',
              summary: {
                ru: 'Нет извлечённого текста для AI-проверки.',
                kk: 'AI тексеруі үшін алынған мәтін жоқ.',
              },
            };
          else if (check.requiresAi && !this.ai.available)
            result = {
              status: 'skipped',
              summary: {
                ru: 'AI не подключён. Этот этап не выполнен.',
                kk: 'AI қосылмаған. Бұл кезең орындалмады.',
              },
            };
          else {
            const context = {
              osint: structuredClone(input.osint),
              evidence: structuredClone(input.evidence),
              findings: structuredClone(findings),
              links: [...input.links],
              signal: controller.signal,
              analyze: async (task: AiTask) => {
                if (!check.requiresAi || aiCalls >= strategy.maxAiCalls)
                  throw new Error('AI_BUDGET_EXCEEDED');
                controller.signal.throwIfAborted();
                aiCalls++;
                return this.ai.analyze(structuredClone(input.evidence), {
                  task,
                  inspectorResponses: structuredClone(input.followUps),
                  osint: structuredClone(input.osint),
                  signal: controller.signal,
                  candidates: structuredClone(findings),
                  previousStages: structuredClone(stages),
                  beforeAttempt: () => {
                    if (attempts >= strategy.maxAiCalls * 4) throw new Error('AI_BUDGET_EXCEEDED');
                    attempts++;
                  },
                  onAttempt: (attempt) => aiAttempts.push(attempt),
                });
              },
            };
            // Enforce the run deadline even for custom providers that ignore cancellation.
            let abortListener: () => void = () => {};
            try {
              result = await Promise.race([
                check.execute(context),
                new Promise<never>((_, reject) => {
                  abortListener = () => reject(new Error('ANALYSIS_TIMEOUT'));
                  controller.signal.addEventListener('abort', abortListener, { once: true });
                  if (controller.signal.aborted) abortListener();
                }),
              ]);
            } finally {
              controller.signal.removeEventListener('abort', abortListener);
            }
            validateFindings(result.findings || [], input);
            for (const finding of result.findings || [])
              finding.scope = input.evidence
                .find((e) => e.id === finding.evidenceId)
                ?.method.startsWith('detective-')
                ? 'related'
                : 'target';
            for (const h of result.legalHypotheses || []) {
              if (
                !h.normQuote ||
                !input.osint?.legalNorms?.some(
                  (n) => n.id === h.normId && n.quote.includes(h.normQuote),
                ) ||
                !h.findingIds.length ||
                h.findingIds.some((id) => !findings.some((f) => f.id === id))
              )
                throw new Error('UNGROUNDED_LEGAL_HYPOTHESIS');
            }
            if (
              result.likelihood !== undefined &&
              (!Number.isFinite(result.likelihood) ||
                result.likelihood < 0 ||
                result.likelihood > 100)
            )
              throw new Error('INVALID_LIKELIHOOD');
            if (result.status === 'completed') {
              findings = mergeFindings(
                result.replaceFindings ? [] : findings,
                result.findings || [],
                check.id,
              );
              if (result.assessment) assessment = result.assessment;
              if (result.likelihood !== undefined) likelihood = result.likelihood;
              if (check.requiresAi) successfulAi++;
            }
          }
        } catch (e) {
          errorCode =
            e instanceof Error && /^[A-Z_]+$/.test(e.message) ? e.message : 'CHECK_FAILED';
        }
        const status = errorCode ? 'failed' : result!.status;
        const summary = errorCode
          ? {
              ru: `Этап не выполнен (${errorCode}). Остальные материалы сохранены.`,
              kk: `Кезең орындалмады (${errorCode}). Қалған материалдар сақталды.`,
            }
          : result!.summary;
        const stage: InspectionStage = {
          legalHypotheses:
            status === 'completed' ? structuredClone(result?.legalHypotheses) : undefined,
          aiAttempts,
          review: status === 'completed' ? result?.review : undefined,
          id: check.id,
          version: check.version,
          name: check.name,
          status,
          startedAt: new Date(start).toISOString(),
          durationMs: Date.now() - start,
          summary,
          observations: status === 'completed' ? structuredClone(result?.findings || []) : [],
          findingIds: status === 'completed' ? (result?.findings || []).map((f) => f.id) : [],
          ...(errorCode ? { errorCode } : {}),
        };
        stages.push(stage);
        if (status !== 'completed')
          issues.push({
            ru: `${check.name.ru}: ${summary.ru}`,
            kk: `${check.name.kk}: ${summary.kk}`,
          });
        onStage(structuredClone(stage));
      }
    } finally {
      clearTimeout(timer);
    }
    if (!hasText)
      issues.push({
        ru: 'Недостаточно извлечённого текста для анализа.',
        kk: 'Талдау үшін алынған мәтін жеткіліксіз.',
      });
    // A partial run must not look like a confident, completed investigation.
    const partial = stages.some((s) => s.status !== 'completed') || !hasText;
    if (partial) likelihood = null;
    return {
      findings,
      assessment,
      likelihood,
      engine: successfulAi ? 'ai' : 'rules',
      issues,
      run: {
        level: strategy.level,
        version: '2.0.0',
        status: partial ? 'partial' : 'completed',
        startedAt,
        completedAt: new Date().toISOString(),
        aiCalls,
        aiAttempts: attempts,
        stages,
      },
    };
  }
}
