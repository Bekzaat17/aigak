import type { CaseRecord } from '../../../shared/types';
import type { CollectedArtifacts } from '../ports/collection';
import type { CaseStore, EvidenceInput } from '../ports/storage';

/** Preserve parent and capture references when isolated artifacts receive durable IDs. */
export async function commitCollectedArtifacts(
  store: Pick<CaseStore, 'addEvidence'>,
  record: CaseRecord,
  artifacts: CollectedArtifacts['artifacts'],
): Promise<string[]> {
  const ids = new Map<string, string>();
  for (const { evidence: e, bytes } of artifacts) {
    const input: EvidenceInput = {
      name: e.name,
      mime: e.mime,
      kind: e.kind,
      method: e.method,
      text: e.text,
      sourceUrl: e.sourceUrl,
      access: e.access,
      parentId: e.parentId ? ids.get(e.parentId) : undefined,
      capture: e.capture
        ? {
            ...e.capture,
            textEvidenceId: ids.get(e.capture.textEvidenceId) || e.capture.textEvidenceId,
          }
        : undefined,
    };
    const saved = await store.addEvidence(record, bytes, input);
    ids.set(e.id, saved.id);
  }
  return [...ids.values()];
}
