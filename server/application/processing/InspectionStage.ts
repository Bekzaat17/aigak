import type { CaseRecord, InspectionStage as StageRecord } from '../../../shared/types.ts';
import type { InspectionInput, InspectionResult } from '../../inspection/contracts.ts';
import { syncQuestions } from '../../revisions.ts';
import type { ProcessingStage } from '../ports/processing.ts';
import type { CaseStore } from '../ports/storage.ts';

export class InspectionStage implements ProcessingStage {
  constructor(
    private readonly store: Pick<CaseStore, 'event'>,
    private readonly inspector: {
      inspect(
        input: InspectionInput,
        onStage?: (stage: StageRecord) => void,
        onStart?: (stage: { id: string; name: { ru: string; kk: string } }) => void,
      ): Promise<InspectionResult>;
    },
  ) {}
  async execute(c: CaseRecord): Promise<void> {
    c.status = 'analyzing';
    c.step = {
      ru: 'Поиск признаков и проверка цитат',
      kk: 'Белгілерді іздеу және дәйексөздерді тексеру',
    };
    this.store.event(c, 'analysis.started');
    const result = await this.inspector.inspect(
      c,
      (stage) => {
        this.store.event(c, 'inspection.stage', `${stage.id}@${stage.version}: ${stage.status}`);
      },
      (stage) => {
        c.step = stage.name;
        this.store.event(c, 'inspection.started', stage.id);
      },
    );
    c.findings = result.findings;
    c.assessment = result.assessment;
    c.likelihood = result.likelihood;
    c.engine = result.engine;
    c.inspection = result.run;
    c.issues.push(...result.issues);
    syncQuestions(c);
    c.reanalysis = false;
    c.materialsPending = false;
  }
}
