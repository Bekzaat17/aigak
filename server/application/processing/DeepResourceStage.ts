import type { CaseRecord } from '../../../shared/types';
import type { OsintReport } from '../../../shared/osint';
import type { OsintInput, SaveArtifact } from '../../osint/contracts';
import type { CaseStore } from '../ports/storage';
import type { ProcessingStage } from '../ports/processing';
import type { ProcessingContext } from '../ports/execution';
export class DeepResourceStage implements ProcessingStage {
  readonly id = 'deep-resource-v1';
  constructor(
    private readonly store: Pick<CaseStore, 'addEvidence' | 'event'>,
    private readonly research: {
      inspect(input: OsintInput, save: SaveArtifact, signal?: AbortSignal): Promise<OsintReport>;
    },
  ) {}
  async execute(c: CaseRecord, context?: ProcessingContext) {
    if (c.analysisLevel !== 'pro' || !c.osint) return;
    c.step = {
      ru: 'История домена, регистрация и архивные источники',
      kk: 'Домен тарихы, тіркелуі және мұрағат дереккөздері',
    };
    await this.store.event(c, 'osint.history.started');
    const history = await this.research.inspect(
      { url: c.sourceUrl, evidence: [] },
      (a, method) =>
        this.store.addEvidence(c, a.bytes, {
          name: a.name,
          mime: a.mime,
          kind: 'metadata',
          method: 'osint-' + method,
          sourceUrl: a.sourceUrl,
        }),
      context?.signal,
    );
    c.osint.observations.push(...history.observations);
    c.osint.stages.push(...history.stages.filter((s) => s.id !== 'contacts'));
    if (history.status === 'partial') c.osint.status = 'partial';
    await this.store.event(c, 'osint.history.completed');
  }
}
