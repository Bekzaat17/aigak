import { z } from 'zod';
import { busyStatuses } from '../../../shared/types.ts';
import type { CaseStore } from '../ports/storage.ts';
export function setFindingRegionCommand(
  store: Pick<CaseStore, 'get' | 'event' | 'verify'>,
  params: { id: string; findingId: string },
  body: unknown,
) {
  const input = z
    .object({
      evidenceId: z.string(),
      x: z.number().min(0).max(1),
      y: z.number().min(0).max(1),
      width: z.number().positive().max(1),
      height: z.number().positive().max(1),
    })
    .parse(body);
  const c = store.get(params.id);
  if (!c) throw Error('NOT_FOUND');
  if (busyStatuses.includes(c.status)) throw Error('CASE_BUSY');
  if (
    input.x + input.width > 1.001 ||
    input.y + input.height > 1.001 ||
    !c.evidence.some((e) => e.id === input.evidenceId && e.mime.startsWith('image/'))
  )
    throw Error('INVALID_REGION');
  const f = c.findings.find((f) => f.id === params.findingId);
  if (!f) throw Error('NOT_FOUND');
  f.region = { ...input, author: 'inspector' };
  c.status = 'review';
  delete c.reviewedAt;
  store.event(c, 'finding.region', JSON.stringify({ id: f.id, ...input }));
  return c;
}
