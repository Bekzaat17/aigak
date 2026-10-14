import { z } from 'zod';
import { getEditableCase } from './get-editable-case.ts';
import type { CaseStore } from '../ports/storage.ts';
export async function answerClarificationCommand(
  store: Pick<CaseStore, 'get' | 'event'>,
  params: { id: string; questionId: string },
  body: unknown,
) {
  const input = z
    .object({ answer: z.enum(['yes', 'no', 'unknown']), note: z.string().max(2000).default('') })
    .parse(body);
  const c = await getEditableCase(store, params.id);
  const q = c.clarifications.find((q) => q.id === params.questionId);
  if (!q) throw new Error('NOT_FOUND');
  q.answer = input.answer;
  q.note = input.note;
  c.status = 'review';
  delete c.reviewedAt;
  await store.event(c, 'clarification.answered', `${q.id}: ${q.answer}; ${q.note}`);
  return c;
}
