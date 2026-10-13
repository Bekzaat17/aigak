import type { CaseRecord, Evidence } from '../../shared/types.ts';
import { createExtraction } from '../bootstrap/create-extraction.ts';
import type { CollectionStorage } from './contracts.ts';

/** Compatibility wrapper; the processing pipeline injects a prepared extraction service. */
export function extractFile(
  store: CollectionStorage & { dir: string },
  record: CaseRecord,
  evidence: Evidence,
) {
  return createExtraction(store, store.dir).extract(record, evidence);
}
