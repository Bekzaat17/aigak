import type { CaseRecord } from '../../../shared/types';
import type { ArtifactReviewer, CollectionWave, CollectedArtifacts } from '../ports/collection';
import type { CaseStore } from '../ports/storage';
import { commitCollectedArtifacts } from './commit-collected-artifacts';

/** Runs isolated strategies in bounded waves; only this orchestrator commits their artifacts. */
export class CollectionOrchestrator {
  constructor(
    private readonly store: Pick<CaseStore, 'addEvidence' | 'save'>,
    private readonly waves: readonly CollectionWave[],
    private readonly review: ArtifactReviewer,
    private readonly budgetMs = 180000,
  ) {}
  async collect(record: CaseRecord, parent?: AbortSignal) {
    const signal = AbortSignal.any([
      AbortSignal.timeout(this.budgetMs),
      ...(parent ? [parent] : []),
    ]);
    record.collection = { status: 'unavailable', attempts: [], budgetMs: this.budgetMs };
    for (const wave of this.waves) {
      if (signal.aborted) break;
      if (wave.fallback && record.collection.status === 'adequate') continue;
      const results = await Promise.all(
        wave.strategies.map(async (strategy) => {
          const start = Date.now();
          let result: CollectedArtifacts;
          try {
            result = await strategy.run(
              structuredClone(record),
              AbortSignal.any([signal, AbortSignal.timeout(strategy.timeoutMs)]),
            );
          } catch {
            result = {
              artifacts: [],
              links: [],
              redirects: [],
              issues: [],
              errorCode: 'STRATEGY_FAILED',
            };
          }
          return { id: strategy.id, start, durationMs: Date.now() - start, result };
        }),
      );
      for (const { id, start, durationMs, result } of results) {
        const reviewed = this.review(
          result.artifacts.map((a) => a.evidence),
          result.errorCode,
        );
        const ids = await commitCollectedArtifacts(this.store, record, result.artifacts);
        record.collection.attempts.push({
          method: id,
          startedAt: new Date(start).toISOString(),
          durationMs,
          ...reviewed,
          evidenceIds: ids,
          ...(result.errorCode ? { errorCode: result.errorCode } : {}),
        });
        record.links = [...new Set([...record.links, ...result.links])].slice(0, 150);
        if (result.redirects.length) record.redirects = result.redirects;
        record.issues.push(...result.issues);
        record.scenarioRun?.actions.push(...(result.agentActions || []), {
          role: 'collection-supervisor',
          action: id,
          status: reviewed.status === 'adequate' ? 'completed' : 'rejected',
          reason:
            reviewed.status === 'adequate'
              ? 'CONTENT_AVAILABLE'
              : result.errorCode || 'INSUFFICIENT_CONTENT',
          startedAt: new Date(start).toISOString(),
          durationMs,
        });
        if (reviewed.status === 'adequate') record.collection.status = 'adequate';
        else if (ids.length && record.collection.status === 'unavailable')
          record.collection.status = 'limited';
        await this.store.save(record);
      }
    }
    if (record.collection.status !== 'adequate')
      record.issues.push({
        ru: 'Доступные стратегии не получили достаточно содержимого. Это не означает отсутствия признаков.',
        kk: 'Қолжетімді тәсілдер жеткілікті мазмұн алмады. Бұл белгілер жоқ дегенді білдірмейді.',
      });
    await this.store.save(record);
  }
}
