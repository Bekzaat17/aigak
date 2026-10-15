import { currentIssues } from '../../../shared/current-issues.ts';
import { currentEvidence } from '../../../shared/current-evidence.ts';
import type { CaseRecord, InspectionStage as StageRecord } from '../../../shared/types.ts';
import type { InspectionInput, InspectionResult } from '../../inspection/contracts.ts';
import { syncQuestions } from '../../revisions.ts';
import type { ProcessingStage } from '../ports/processing.ts';
import type { CaseStore } from '../ports/storage.ts';

export class InspectionStage implements ProcessingStage {
  readonly id = 'inspection-v1';
  constructor(
    private readonly store: Pick<CaseStore, 'event'>,
    private readonly inspector: {
      inspect(
        input: InspectionInput,
        onStage?: (stage: StageRecord) => void | Promise<void>,
        onStart?: (stage: { id: string; name: { ru: string; kk: string } }) => void | Promise<void>,
        signal?: AbortSignal,
      ): Promise<InspectionResult>;
    },
  ) {}
  async execute(
    c: CaseRecord,
    context?: import('../ports/execution').ProcessingContext,
  ): Promise<void> {
    c.status = 'analyzing';
    c.findings = [];
    c.likelihood = null;
    c.inspection = {
      level: c.analysisLevel,
      version: '2.0.0',
      status: 'partial',
      startedAt: new Date().toISOString(),
      completedAt: '',
      aiCalls: 0,
      aiAttempts: 0,
      stages: [],
    };
    c.assessment = {
      ru: 'Проверка содержимого ещё не завершена.',
      kk: 'Мазмұнды тексеру әлі аяқталмады.',
    };
    c.step = {
      ru: 'Поиск признаков и проверка цитат',
      kk: 'Белгілерді іздеу және дәйексөздерді тексеру',
    };
    await this.store.event(c, 'analysis.started');
    const result = await this.inspector.inspect(
      { ...c, evidence: currentEvidence(c) },
      async (stage) => {
        c.inspection!.stages.push(stage);
        c.inspection!.aiAttempts = c.inspection!.stages.reduce(
          (n, s) => n + (s.aiAttempts?.length || 0),
          0,
        );
        c.inspection!.aiCalls = c.inspection!.stages.filter((s) => s.aiAttempts?.length).length;
        await this.store.event(
          c,
          'inspection.stage',
          `${stage.id}@${stage.version}: ${stage.status}`,
        );
      },
      async (stage) => {
        c.step = stage.name;
        await this.store.event(c, 'inspection.started', stage.id);
      },
      context?.signal,
    );
    c.findings = result.findings;
    c.assessment = result.assessment;
    c.likelihood = result.likelihood;
    c.engine = result.engine;
    c.inspection = result.run;
    c.issues = currentIssues(c);
    c.issues.push(...result.issues);
    syncQuestions(c);
    c.reanalysis = false;
    c.refreshSources = false;
    c.materialsPending = false;
  }
}
