import type { CaseRecord } from '../../shared/types.ts';
import type { CollectionStorage, EvidenceExtractor } from '../collection/contracts.ts';
import { HttpCollectionMethod } from '../collection/HttpCollectionMethod.ts';
import { BrowserCollectionMethod } from '../collection/BrowserCollectionMethod.ts';
import { UrlCollectionService } from '../collection/UrlCollectionService.ts';

export function createUrlCollector(store: CollectionStorage, extraction: EvidenceExtractor) {
  return new UrlCollectionService(store, [
    new HttpCollectionMethod(store, extraction),
    new BrowserCollectionMethod('browser-desktop', store, extraction, {
      width: 1440,
      height: 1000,
    }),
    new BrowserCollectionMethod(
      'browser-mobile',
      store,
      extraction,
      { width: 430, height: 932 },
      true,
    ),
  ]);
}
export async function collectUrl(
  store: CollectionStorage,
  record: CaseRecord,
  extraction: EvidenceExtractor,
) {
  return createUrlCollector(store, extraction).collect(record);
}
