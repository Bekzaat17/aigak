import { z } from 'zod';
import { busyStatuses } from '../../../shared/types.ts';
import type { CaseStore } from '../ports/storage.ts';
export async function saveLegalReviewCommand(
  store: Pick<CaseStore, 'get' | 'event' | 'verify'>,
  params: { id: string },
  body: unknown,
) {
  const input = z
    .object({
      eventDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
      jurisdictionConfirmed: z.boolean(),
      editionConfirmed: z.boolean(),
      officer: z.string().trim().min(2).max(150),
      note: z.string().trim().min(10).max(5000),
    })
    .parse(body);
  if (
    Number.isNaN(Date.parse(input.eventDate)) ||
    new Date(input.eventDate).toISOString().slice(0, 10) !== input.eventDate
  )
    throw Error('VALIDATION_ERROR');
  const c = await store.get(params.id);
  if (!c) throw Error('NOT_FOUND');
  if (busyStatuses.includes(c.status)) throw Error('CASE_BUSY');
  c.legalReview = input;
  c.status = 'review';
  delete c.reviewedAt;
  await store.event(c, 'legal.reviewed', JSON.stringify(input));
  return c;
}
