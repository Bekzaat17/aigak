import type { CaseRecord } from '../../../shared/types';
import type { OsintReport } from '../../../shared/osint';
import type { SaveArtifact } from '../../osint/contracts';
import type { ProcessingStage } from '../ports/processing';
import type { CaseStore } from '../ports/storage';
/** Legal retrieval has its own budget so a slow registry cannot prevent it from running. */
export class LegalCorpusStage implements ProcessingStage {
  readonly id = 'legal-corpus-v1';
  constructor(
    private readonly store: Pick<CaseStore, 'event' | 'addEvidence'>,
    private readonly corpus: { enrich(report: OsintReport, save: SaveArtifact): Promise<void> },
  ) {}
  async execute(record: CaseRecord) {
    if (record.analysisLevel !== 'pro') return;
    if (!record.osint) throw Error('OSINT_REQUIRED');
    record.step = {
      ru: 'Сохраняем официальные нормы законодательства РК',
      kk: 'ҚР заңнамасының ресми нормаларын сақтаймыз',
    };
    await this.store.event(record, 'legal.corpus.started');
    await this.corpus.enrich(record.osint, (artifact, method) =>
      this.store.addEvidence(record, artifact.bytes, {
        name: artifact.name,
        mime: artifact.mime,
        kind: 'metadata',
        method,
        sourceUrl: artifact.sourceUrl,
      }),
    );
    await this.store.event(record, 'legal.corpus.completed');
  }
}
