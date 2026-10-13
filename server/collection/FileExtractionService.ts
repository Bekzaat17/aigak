import type { CaseRecord, Evidence } from '../../shared/types.ts';
import type { CollectionStorage, FileExtractor } from './contracts.ts';
import { issue } from './text-evidence.ts';

/** Register another extractor in bootstrap to support a new format. */
export class FileExtractionService {
  constructor(
    private readonly store: CollectionStorage,
    private readonly extractors: readonly FileExtractor[],
  ) {}

  async extract(record: CaseRecord, evidence: Evidence): Promise<void> {
    const data = this.store.read(record, evidence);
    try {
      const extractor = this.extractors.find((candidate) => candidate.supports(evidence.mime));
      if (extractor) await extractor.extract({ store: this.store, record, evidence, data });
      else
        issue(
          record,
          `${evidence.name}: оригинал сохранён, автоматическое извлечение этого формата пока не поддерживается.`,
          `${evidence.name}: түпнұсқа сақталды, бұл пішімнен автоматты мәтін алу әзірше қолдау таппайды.`,
        );
    } catch {
      issue(
        record,
        `${evidence.name}: не удалось извлечь текст. Оригинал сохранён.`,
        `${evidence.name}: мәтінді алу мүмкін болмады. Түпнұсқа сақталды.`,
      );
    }
    this.store.save(record);
  }
}
