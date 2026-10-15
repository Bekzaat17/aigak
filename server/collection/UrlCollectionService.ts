import { collectionError } from './collection-error';
import { StorageFailure } from '../application/errors/StorageFailure.ts';
import { reviewCollectionAttempt } from '../domain/review-collection-attempt';
import type { CaseRecord } from '../../shared/types.ts';
import type { CollectionReviewer, CollectionStorage, UrlCollectionMethod } from './contracts.ts';

/** Each method is independent: an HTTP failure must not suppress browser collection. */
export class UrlCollectionService {
  constructor(
    private readonly store: Pick<CollectionStorage, 'save'>,
    private readonly methods: readonly UrlCollectionMethod[],
    private readonly review: CollectionReviewer = reviewCollectionAttempt,
  ) {}
  async collect(record: CaseRecord, signal?: AbortSignal) {
    const budgetMs = record.analysisLevel === 'pro' ? 300000 : 180000;
    const deadline = AbortSignal.timeout(budgetMs);
    const activeSignal = signal ? AbortSignal.any([signal, deadline]) : deadline;
    record.collection = { status: 'unavailable', attempts: [], budgetMs };
    for (const method of this.methods) {
      signal?.throwIfAborted();
      if (activeSignal.aborted) break;
      if (method.supports && !method.supports(record)) continue;
      if (method.proOnly && record.analysisLevel !== 'pro') continue;
      if (method.fallback && record.collection.attempts.at(-1)?.status === 'adequate') continue;
      const before = new Set(record.evidence.map((e) => e.id));
      const start = Date.now();
      let errorCode: string | undefined;
      try {
        await method.collect(
          record,
          AbortSignal.any([activeSignal, AbortSignal.timeout(method.timeoutMs || 90000)]),
        );
      } catch (error) {
        if (
          error instanceof StorageFailure ||
          (error instanceof Error && error.message === 'CASE_CONFLICT')
        )
          throw error;
        signal?.throwIfAborted();
        errorCode = collectionError(error);
      }
      const added = record.evidence.filter((e) => !before.has(e.id));
      const reviewed = this.review(added, errorCode);
      record.collection.attempts.push({
        method: method.id,
        startedAt: new Date(start).toISOString(),
        durationMs: Date.now() - start,
        ...reviewed,
        evidenceIds: added.map((e) => e.id),
        ...(errorCode ? { errorCode } : {}),
      });
      if (reviewed.status === 'adequate') record.collection.status = 'adequate';
      else if (added.length && record.collection.status === 'unavailable')
        record.collection.status = 'limited';
      await this.store.save(record);
    }
    if (record.collection.status !== 'adequate')
      record.issues.push({
        ru: 'После нескольких способов сбора содержимого недостаточно. Пустая страница, заставка или блокировка не означают отсутствие игорных признаков.',
        kk: 'Бірнеше жинау тәсілінен кейін мазмұн жеткіліксіз. Бос бет, жүктеу экраны немесе бұғаттау ойын белгілерінің жоқтығын білдірмейді.',
      });
    await this.store.save(record);
    if (record.collection.status === 'unavailable') throw Error('ALL_CAPTURE_METHODS_FAILED');
  }
}
