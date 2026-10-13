import type { CaseRecord, Lang } from '../../../shared/types.ts';

export interface CaseDocuments {
  preview(record: CaseRecord, lang: Lang): string;
  document(record: CaseRecord, lang: Lang): Promise<Buffer>;
  archive(record: CaseRecord): Promise<Buffer>;
}
