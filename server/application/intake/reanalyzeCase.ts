import { z } from 'zod';
import { startRevision } from '../../revisions.ts';
import type { IntakeDependencies } from './contracts.ts';
export async function reanalyzeCase(
  { store, queue }: Pick<IntakeDependencies, 'store' | 'queue'>,
  id: string,
  body: unknown,
) {
  const { analysisLevel, refreshSources } = z
    .object({
      analysisLevel: z.enum(['basic', 'advanced', 'pro']),
      refreshSources: z.boolean().default(false),
    })
    .parse(body);
  if ((await queue.countPending()) >= 20) throw Error('QUEUE_FULL');
  const c = await store.get(id);
  if (!c) throw Error('NOT_FOUND');
  await startRevision(store, c, analysisLevel);
  c.refreshSources = refreshSources;
  if (refreshSources) c.issues = [];
  await store.save(c);
  await queue.add(c.id);
  return await store.get(c.id);
}
