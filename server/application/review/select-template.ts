import { z } from 'zod';
import { busyStatuses } from '../../../shared/types.ts';
import type { CaseStore } from '../ports/storage.ts';
import type { TemplateCatalog } from '../ports/templates.ts';
export function selectTemplateCommand(
  store: Pick<CaseStore, 'get' | 'event' | 'verify'>,
  params: { id: string },
  body: unknown,
  templates: Pick<TemplateCatalog, 'has'>,
) {
  const { templateId } = z.object({ templateId: z.string() }).parse(body);
  if (!templates.has(templateId)) throw Error('NOT_FOUND');
  const c = store.get(params.id);
  if (!c) throw Error('NOT_FOUND');
  if (busyStatuses.includes(c.status)) throw Error('CASE_BUSY');
  c.templateId = templateId;
  c.status = 'review';
  delete c.reviewedAt;
  store.event(c, 'template.selected', templateId);
  return c;
}
