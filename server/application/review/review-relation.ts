import { z } from 'zod';
import { getEditableCase } from './get-editable-case.ts';
import type { CaseStore } from '../ports/storage.ts';
export async function reviewRelationCommand(
  store: Pick<CaseStore, 'get' | 'event'>,
  params: { id: string; relationId: string },
  body: unknown,
) {
  const input = z
    .object({ decision: z.enum(['accepted', 'rejected', 'pending']), note: z.string().max(2000) })
    .parse(body);
  const c = await getEditableCase(store, params.id);
  const relation = c.osint?.relations?.find((r) => r.id === params.relationId);
  if (!relation) throw Error('NOT_FOUND');
  Object.assign(relation, input);
  c.status = 'review';
  delete c.reviewedAt;
  await store.event(c, 'relation.reviewed', JSON.stringify({ id: relation.id, ...input }));
  return c;
}
