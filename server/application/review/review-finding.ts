import { z } from 'zod';
import type { CaseStore } from '../ports/storage.ts';
import { reviewFinding } from '../review-case.ts';
export function reviewFindingCommand(
  store: Pick<CaseStore, 'get' | 'event' | 'verify'>,
  params: { id: string; findingId: string },
  body: unknown,
) {
  const { decision, note } = z
    .object({
      decision: z.enum(['pending', 'accepted', 'rejected']),
      note: z.string().max(2000).default(''),
    })
    .parse(body);
  const c = store.get(params.id);
  if (!c) throw new Error('NOT_FOUND');
  reviewFinding(store, c, params.findingId, decision, note);
  return c;
}
