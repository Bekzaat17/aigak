import { z } from 'zod';
import type { CaseStore } from '../ports/storage.ts';
import { approveCase } from '../review-case.ts';
export async function approveCaseCommand(
  store: Pick<CaseStore, 'get' | 'event' | 'verify'>,
  params: { id: string },
  body: unknown,
) {
  const { officer, notes } = z
    .object({
      officer: z.string().trim().min(2).max(150),
      notes: z.string().trim().min(5).max(5000),
    })
    .parse(body);
  const c = await store.get(params.id);
  if (!c) throw new Error('NOT_FOUND');
  await approveCase(store, c, officer, notes);
  return c;
}
