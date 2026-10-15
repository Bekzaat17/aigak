import type { CaseRecord } from '../../../shared/types';
import type { ArtifactReviewer, CollectedArtifacts, CollectionStrategy } from '../ports/collection';
import type { CaseStore } from '../ports/storage';
import { commitCollectedArtifacts } from './commit-collected-artifacts';

/** A public page may use fallback transports; only reviewed artifacts become analysis input. */
export async function collectPublicPage(
  store: Pick<CaseStore, 'addEvidence' | 'event'>,
  c: CaseRecord,
  url: string,
  strategies: readonly CollectionStrategy[],
  review: ArtifactReviewer,
  signal: AbortSignal,
  prefix: string,
): Promise<{ available: boolean; evidenceIds: string[] }> {
  const evidenceIds: string[] = [];
  if (!c.collection) return { available: false, evidenceIds };
  for (const strategy of strategies) {
    signal.throwIfAborted();
    const start = Date.now();
    const timeout = AbortSignal.any([signal, AbortSignal.timeout(strategy.timeoutMs)]);
    let result: CollectedArtifacts;
    let abort = () => {};
    try {
      result = await Promise.race([
        strategy.run({ ...structuredClone(c), sourceUrl: url }, timeout),
        new Promise<never>((_, reject) => {
          abort = () => reject(Error('COLLECTION_TIMEOUT'));
          timeout.addEventListener('abort', abort, { once: true });
          if (timeout.aborted) abort();
        }),
      ]);
    } catch {
      result = {
        artifacts: [],
        links: [],
        redirects: [],
        issues: [],
        errorCode: timeout.aborted ? 'COLLECTION_TIMEOUT' : 'STRATEGY_FAILED',
      };
    } finally {
      timeout.removeEventListener('abort', abort);
    }
    signal.throwIfAborted();
    const reviewed = review(
      result.artifacts.map((a) => a.evidence),
      result.errorCode,
    );
    const ids = await commitCollectedArtifacts(store, c, result.artifacts);
    evidenceIds.push(...ids);
    c.collection.attempts.push({
      method: prefix + ':' + strategy.id,
      startedAt: new Date(start).toISOString(),
      durationMs: Date.now() - start,
      ...reviewed,
      evidenceIds: ids,
      errorCode: result.errorCode,
    });
    // URLs from limited/challenge pages never expand the crawl frontier.
    if (reviewed.status === 'adequate')
      c.links = [...new Set([...c.links, ...result.links])].slice(0, 200);
    await store.event(c, prefix + '.collected', `${url} ${strategy.id} ${reviewed.status}`);
    if (reviewed.status === 'adequate') {
      c.collection.status = 'adequate';
      return { available: true, evidenceIds };
    }
  }
  return { available: false, evidenceIds };
}
