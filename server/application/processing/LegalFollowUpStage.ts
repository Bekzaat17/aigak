import { currentEvidence } from '../../../shared/current-evidence';
import { syncQuestions } from '../../revisions';
import type { CaseRecord, InspectionStage } from '../../../shared/types';
import type { InspectionInput, InspectionResult } from '../../inspection/contracts';
import { collectPublicPage } from '../collection/collect-public-page';
import type { ArtifactReviewer, CollectionStrategy } from '../ports/collection';
import type { PagePlanner } from '../ports/page-exploration';
import type { ProcessingContext } from '../ports/execution';
import type { ProcessingStage } from '../ports/processing';
import type { CaseStore } from '../ports/storage';

/** One bounded feedback cycle. Collection and reasoning are replaceable ports, not prompts. */
export class LegalFollowUpStage implements ProcessingStage {
  readonly id = 'legal-follow-up-v1';
  constructor(
    private readonly store: Pick<CaseStore, 'addEvidence' | 'event'>,
    private readonly planner: PagePlanner,
    private readonly strategies: readonly CollectionStrategy[],
    private readonly review: ArtifactReviewer,
    private readonly inspector: {
      inspect(
        input: InspectionInput,
        onStage?: (s: InspectionStage) => Promise<void>,
        onStart?: (s: { id: string; name: { ru: string; kk: string } }) => Promise<void>,
        signal?: AbortSignal,
      ): Promise<InspectionResult>;
    },
  ) {}
  async execute(c: CaseRecord, context?: ProcessingContext): Promise<void> {
    if (c.analysisLevel !== 'pro' || !c.inspection || !c.collection || !c.osint) return;
    const signal = context?.signal || AbortSignal.timeout(100000);
    const started = Date.now();
    const requests = this.planner.plan(c).slice(0, 2);
    const evidenceIds: string[] = [];
    let available = 0;
    c.step = {
      ru: 'Юрист проверяет дополнительные документы сайта',
      kk: 'Заңгер сайттың қосымша құжаттарын тексереді',
    };
    await this.store.event(c, 'legal.follow-up.planned', `${requests.length} public documents`);
    for (const request of requests) {
      const result = await collectPublicPage(
        this.store,
        c,
        request.url,
        this.strategies,
        this.review,
        signal,
        'legal-follow-up',
      );
      evidenceIds.push(...result.evidenceIds);
      if (result.available) available++;
    }

    c.osint.stages.push({
      id: 'legal-follow-up',
      version: '1.0.0',
      status: !requests.length
        ? 'skipped'
        : available === requests.length
          ? 'completed'
          : 'partial',
      durationMs: Date.now() - started,
      evidenceIds,
      summary: {
        ru: requests.length
          ? `Автоматически проверены дополнительные документы сайта: ${available}/${requests.length}. HTTP и резервный браузер; отсутствие документа не доказывает нарушение.`
          : 'Новых опубликованных ссылок на условия, лицензию или политику данных не найдено. Закрытые сведения не подменяются предположениями.',
        kk: requests.length
          ? `Сайттың қосымша құжаттары автоматты түрде тексерілді: ${available}/${requests.length}. Құжаттың болмауы бұзушылықты дәлелдемейді.`
          : 'Шарттарға, лицензияға немесе деректер саясатына жаңа жария сілтемелер табылмады.',
      },
    });
    if (!available) {
      await this.store.event(c, 'legal.follow-up.completed', 'NO_ADDITIONAL_CONTENT');
      return;
    }
    const previous = structuredClone(c.inspection);
    c.materialsPending = true;
    const result = await this.inspector.inspect(
      { ...c, evidence: currentEvidence(c) },
      async (s) => {
        c.inspection!.stages.push({ ...s, id: 'follow-up-progress-' + s.id });
        c.inspection!.aiAttempts = (c.inspection!.aiAttempts || 0) + (s.aiAttempts?.length || 0);
        if (s.aiAttempts?.length) c.inspection!.aiCalls++;
        await this.store.event(c, 'legal.follow-up.analysis', `${s.id}: ${s.status}`);
      },
      undefined,
      signal,
    );
    signal.throwIfAborted();
    const complete = ['verification', 'legal', 'pro_review'].every((id) =>
      result.run.stages.some((s) => s.id === id && s.status === 'completed'),
    );
    // Preserve both histories and consumption. Failed reassessment cannot replace a valid conclusion.
    const historical = (stages: InspectionStage[], prefix: string) =>
      stages.map((s) => ({ ...s, id: prefix + s.id }));
    c.inspection = {
      ...(complete ? result.run : previous),
      startedAt: previous.startedAt,
      completedAt: result.run.completedAt,
      aiCalls: previous.aiCalls + result.run.aiCalls,
      aiAttempts: (previous.aiAttempts || 0) + (result.run.aiAttempts || 0),
      status: complete ? result.run.status : 'partial',
      stages: complete
        ? [...historical(previous.stages, 'initial-'), ...result.run.stages]
        : [...previous.stages, ...historical(result.run.stages, 'follow-up-')],
    };
    if (complete) {
      c.findings = result.findings;
      c.assessment = result.assessment;
      c.likelihood = result.likelihood;
      c.engine = result.engine;
      c.materialsPending = false;
      syncQuestions(c);
    } else c.materialsPending = true;
    c.issues.push(...result.issues);
    await this.store.event(
      c,
      'legal.follow-up.completed',
      complete ? 'REASSESSED' : 'REASSESSMENT_INCOMPLETE',
    );
  }
}
