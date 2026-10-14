import { busyStatuses } from '../../../shared/types.ts';
import type { CaseRepository } from '../ports/storage.ts';

export async function getEditableCase(store: Pick<CaseRepository, 'get'>, id: string) {
  const record = await store.get(id);
  if (!record) throw new Error('NOT_FOUND');
  if (busyStatuses.includes(record.status)) throw new Error('CASE_BUSY');
  return record;
}
