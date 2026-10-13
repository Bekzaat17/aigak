import type { CaseRecord, Evidence } from '../../../shared/types.ts';
import type { ProcessingStage } from '../ports/processing.ts';
import type { CaseStore } from '../ports/storage.ts';

export class CollectionStage implements ProcessingStage {
  constructor(
    private readonly store: Pick<CaseStore, 'event'>,
    private readonly collectUrl: (c: CaseRecord) => Promise<void>,
    private readonly extractFile: (c: CaseRecord, e: Evidence) => Promise<void>,
  ) {}
  async execute(c: CaseRecord): Promise<void> {
    c.status = 'collecting';
    c.step = { ru: 'Фиксация и извлечение текста', kk: 'Тіркеу және мәтінді алу' };
    this.store.event(c, 'collection.started');
    if (c.sourceType === 'url' && !c.reanalysis) await this.collectUrl(c);
    for (const e of [...c.evidence])
      if (e.kind === 'original' && !c.evidence.some((child) => child.parentId === e.id))
        await this.extractFile(c, e);
  }
}
