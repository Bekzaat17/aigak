import type { CaseRecord } from '../../shared/types';
import type { CollectionStrategy, CollectedArtifacts } from '../application/ports/collection';
import type { CollectionStorage, UrlCollectionMethod } from './contracts';
import { EvidenceService } from '../application/storage/EvidenceService';
import { MemoryBlobStorage } from '../storage/MemoryBlobStorage';
import { collectionError } from './collection-error';

/** Each worker gets an isolated case and bounded memory blobs, never the durable case store. */
export class IsolatedCollectionStrategy implements CollectionStrategy {
  constructor(
    readonly id: string,
    readonly timeoutMs: number,
    private readonly create: (store: CollectionStorage) => UrlCollectionMethod,
  ) {}
  async run(snapshot: Readonly<CaseRecord>, signal: AbortSignal): Promise<CollectedArtifacts> {
    const c: CaseRecord = structuredClone(snapshot);
    c.evidence = [];
    c.links = [];
    c.redirects = [];
    c.issues = [];
    if (c.scenarioRun) c.scenarioRun.actions = [];
    const blobs = new MemoryBlobStorage();
    const evidence = new EvidenceService(blobs, {
      event: async () => {
        signal.throwIfAborted();
      },
    });
    const method = this.create({
      addEvidence: async (...args) => {
        signal.throwIfAborted();
        return evidence.addEvidence(...args);
      },
      read: (...args) => evidence.read(...args),
      save: async () => {
        signal.throwIfAborted();
      },
    });
    let errorCode: string | undefined;
    let abort = () => {};
    try {
      signal.throwIfAborted();
      await Promise.race([
        method.collect(c, signal),
        new Promise<never>((_, reject) => {
          abort = () => reject(Error('COLLECTION_TIMEOUT'));
          signal.addEventListener('abort', abort, { once: true });
          if (signal.aborted) abort();
        }),
      ]);
    } catch (error) {
      errorCode = collectionError(error);
    } finally {
      signal.removeEventListener('abort', abort);
    }
    return {
      artifacts: c.evidence.map((e) => ({
        evidence: structuredClone(e),
        bytes: evidence.read(c, e),
      })),
      links: [...c.links],
      redirects: structuredClone(c.redirects),
      issues: structuredClone(c.issues),
      errorCode,
      agentActions: structuredClone(c.scenarioRun?.actions || []),
    };
  }
}
