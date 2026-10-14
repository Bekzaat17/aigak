import { StorageFailure } from '../application/errors/StorageFailure.ts';
import { pageTextQuality } from '../../shared/collection.ts';
import type { CaseRecord } from '../../shared/types.ts';
import type { CollectionStorage, UrlCollectionMethod } from './contracts.ts';

/** Each method is independent: an HTTP failure must not suppress browser collection. */
export class UrlCollectionService {
  constructor(
    private readonly store: Pick<CollectionStorage, 'save'>,
    private readonly methods: readonly UrlCollectionMethod[],
  ) {}
  async collect(record: CaseRecord, signal = AbortSignal.timeout(240000)) {
    record.collection = { status: 'unavailable', attempts: [] };
    for (const method of this.methods) {
      signal.throwIfAborted();
      if (method.fallback && record.collection.attempts.at(-1)?.status === 'adequate') continue;
      const before = new Set(record.evidence.map((e) => e.id));
      const start = Date.now();
      let errorCode: string | undefined;
      try {
        await method.collect(record, signal);
      } catch (error) {
        if (
          error instanceof StorageFailure ||
          (error instanceof Error && error.message === 'CASE_CONFLICT')
        )
          throw error;
        signal.throwIfAborted();
        errorCode =
          error instanceof Error && /^[A-Z_]+$/.test(error.message)
            ? error.message
            : 'CAPTURE_FAILED';
      }
      const added = record.evidence.filter((e) => !before.has(e.id));
      const texts = added.filter((e) => e.kind === 'text' && e.text).map((e) => e.text!);
      const textLength = Math.max(0, ...texts.map((text) => text.length));
      const quality = texts.some((text) => pageTextQuality(text) === 'adequate')
        ? 'adequate'
        : 'limited';
      record.collection.attempts.push({
        method: method.id,
        startedAt: new Date(start).toISOString(),
        durationMs: Date.now() - start,
        status: errorCode ? 'failed' : quality,
        textLength,
        evidenceIds: added.map((e) => e.id),
        ...(errorCode ? { errorCode } : {}),
      });
      if (quality === 'adequate') record.collection.status = 'adequate';
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
