import { z } from 'zod';
import { getEditableCase } from './get-editable-case.ts';
import type { CaseStore } from '../ports/storage.ts';
import type { TemplateCatalog } from '../ports/templates.ts';
export async function selectTemplateCommand(
  store: Pick<CaseStore, 'get' | 'event'>,
  params: { id: string },
  body: unknown,
  templates: Pick<TemplateCatalog, 'has'>,
) {
  const { templateId } = z.object({ templateId: z.string() }).parse(body);
  if (!(await templates.has(templateId))) throw Error('NOT_FOUND');
  const c = await getEditableCase(store, params.id);
  c.templateId = templateId;
  c.status = 'review';
  delete c.reviewedAt;
  await store.event(c, 'template.selected', templateId);
  return c;
}
