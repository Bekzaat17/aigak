import { z } from 'zod';
import { getEditableCase } from './get-editable-case.ts';
import type { CaseStore } from '../ports/storage.ts';
export async function answerQuestionCommand(
  store: Pick<CaseStore, 'get' | 'event'>,
  params: { id: string; questionId: string },
  body: unknown,
) {
  const input = z
    .object({ answer: z.string().trim().max(4000), evidenceIds: z.array(z.string()).max(30) })
    .parse(body);
  const c = await getEditableCase(store, params.id);
  const q = c.followUps?.find((q) => q.id === params.questionId);
  if (!q) throw Error('NOT_FOUND');
  if (input.evidenceIds.some((id) => !c.evidence.some((e) => e.id === id)))
    throw Error('NOT_FOUND');
  Object.assign(q, input);
  c.status = 'review';
  delete c.reviewedAt;
  await store.event(c, 'question.answered', JSON.stringify({ id: q.id, ...input }));
  return c;
}
