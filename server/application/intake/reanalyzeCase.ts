import { z } from 'zod';
import { startRevision } from '../../revisions.ts';
import type { IntakeDependencies } from './contracts.ts';
export function reanalyzeCase(
  { store, queue }: Pick<IntakeDependencies, 'store' | 'queue'>,
  id: string,
  body: unknown,
) {
  const { analysisLevel } = z
    .object({ analysisLevel: z.enum(['basic', 'advanced', 'pro']) })
    .parse(body);
  if (queue.pendingCount >= 20) throw Error('QUEUE_FULL');
  const c = store.get(id);
  if (!c) throw Error('NOT_FOUND');
  startRevision(store, c, analysisLevel);
  queue.add(c.id);
  return store.get(c.id);
}
