import { busyStatuses, type CaseRecord } from '../../shared/types';
import type { CaseStore } from './ports/storage';

/** Explicit revalidation retains originals and records the previous visual decisions. */
export async function reverifyCaseEvidence(
  id: string,
  store: Pick<CaseStore, 'get' | 'event'>,
  verifier: { verify(record: CaseRecord, signal?: AbortSignal): Promise<void> },
  signal?: AbortSignal,
) {
  const record = await store.get(id);
  if (!record) throw Error('NOT_FOUND');
  if (busyStatuses.includes(record.status)) throw Error('CASE_BUSY');
  if (record.status === 'verified') throw Error('INSPECTOR_REVIEW_ALREADY_COMPLETED');
  const previous = record.findings.map((f) => ({ id: f.id, visualEvidence: f.visualEvidence }));
  for (const finding of record.findings) delete finding.visualEvidence;
  await store.event(record, 'visual-revalidation.started', JSON.stringify(previous));
  try {
    await verifier.verify(record, signal);
    await store.event(record, 'visual-revalidation.completed');
  } catch (error) {
    for (const finding of record.findings)
      if (!finding.visualEvidence)
        finding.visualEvidence = { status: 'unavailable', reason: 'REVALIDATION_FAILED' };
    await store.event(record, 'visual-revalidation.failed');
    throw error;
  }
  return record;
}
