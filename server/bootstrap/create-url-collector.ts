import type { UrlCollectionMethod } from '../collection/contracts';
import { openNativeSession } from '../collection/browser/open-native-session';
import type { CaseRecord } from '../../shared/types.ts';
import type { CollectionStorage, EvidenceExtractor } from '../collection/contracts.ts';
import { HttpCollectionMethod } from '../collection/HttpCollectionMethod.ts';
import { BrowserCollectionMethod } from '../collection/BrowserCollectionMethod.ts';
import { UrlCollectionService } from '../collection/UrlCollectionService.ts';

export function createUrlCollector(
  store: CollectionStorage,
  extraction: EvidenceExtractor,
  additional: UrlCollectionMethod[] = [],
) {
  return new UrlCollectionService(store, [
    new HttpCollectionMethod(store, extraction),
    new BrowserCollectionMethod('browser-desktop', store, extraction, {
      width: 1440,
      height: 1000,
    }),
    new BrowserCollectionMethod(
      'browser-native',
      store,
      extraction,
      { width: 1440, height: 1000 },
      true,
      openNativeSession,
    ),
    new BrowserCollectionMethod(
      'browser-mobile',
      store,
      extraction,
      { width: 430, height: 932 },
      true,
    ),
    new BrowserCollectionMethod(
      'browser-native-retry',
      store,
      extraction,
      { width: 430, height: 932 },
      true,
      openNativeSession,
    ),
    ...additional,
  ]);
}
export async function collectUrl(
  store: CollectionStorage,
  record: CaseRecord,
  extraction: EvidenceExtractor,
) {
  return createUrlCollector(store, extraction).collect(record);
}
