import { z } from 'zod';
import { busyStatuses } from '../../../shared/types.ts';
import type { CaseStore } from '../ports/storage.ts';
export function reviewRelationCommand(
  store: Pick<CaseStore, 'get' | 'event' | 'verify'>,
  params: { id: string; relationId: string },
  body: unknown,
) {
  const input = z
    .object({ decision: z.enum(['accepted', 'rejected', 'pending']), note: z.string().max(2000) })
    .parse(body);
  const c = store.get(params.id);
  if (!c) throw Error('NOT_FOUND');
  if (busyStatuses.includes(c.status)) throw Error('CASE_BUSY');
  const relation = c.osint?.relations?.find((r) => r.id === params.relationId);
  if (!relation) throw Error('NOT_FOUND');
  Object.assign(relation, input);
  c.status = 'review';
  delete c.reviewedAt;
  store.event(c, 'relation.reviewed', JSON.stringify({ id: relation.id, ...input }));
  return c;
}
