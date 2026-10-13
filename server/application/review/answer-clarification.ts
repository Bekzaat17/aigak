import { z } from 'zod';
import { busyStatuses } from '../../../shared/types.ts';
import type { CaseStore } from '../ports/storage.ts';
export function answerClarificationCommand(
  store: Pick<CaseStore, 'get' | 'event' | 'verify'>,
  params: { id: string; questionId: string },
  body: unknown,
) {
  const input = z
    .object({ answer: z.enum(['yes', 'no', 'unknown']), note: z.string().max(2000).default('') })
    .parse(body);
  const c = store.get(params.id);
  if (!c) throw new Error('NOT_FOUND');
  if (busyStatuses.includes(c.status)) throw new Error('CASE_BUSY');
  const q = c.clarifications.find((q) => q.id === params.questionId);
  if (!q) throw new Error('NOT_FOUND');
  q.answer = input.answer;
  q.note = input.note;
  c.status = 'review';
  delete c.reviewedAt;
  store.event(c, 'clarification.answered', `${q.id}: ${q.answer}; ${q.note}`);
  return c;
}
