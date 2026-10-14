import { normalizeUrlInput } from '../../../shared/url-input.ts';
import { detectMime } from '../../domain/detect-mime.ts';
import { parsePublicUrl } from '../../domain/public-url.ts';
import { newCase } from '../create-case.ts';
import type { IntakeDependencies, UploadedFile } from './contracts.ts';
import { intake } from './schema.ts';
export async function submitCase(
  { store, queue, templates }: IntakeDependencies,
  body: unknown,
  files: UploadedFile[],
) {
  if ((await queue.countPending()) >= 20) throw Error('QUEUE_FULL');
  const input = intake.parse(body);

  if (!(await templates.has(input.templateId))) throw new Error('NOT_FOUND');
  if (input.sourceType === 'url') {
    input.sourceUrl = normalizeUrlInput(input.sourceUrl || '');
    parsePublicUrl(input.sourceUrl);
  }
  if (input.sourceType === 'text' && !input.text?.trim()) throw new Error('EMPTY_INPUT');
  if (input.sourceType === 'file' && !files.length) throw new Error('EMPTY_INPUT');
  const prepared =
    input.sourceType === 'file'
      ? files.map((file) => ({ ...file, mime: detectMime(file.buffer, file.name) }))
      : [];
  const c = await newCase(store, {
    title: input.title,
    sourceType: input.sourceType,
    sourceUrl: input.sourceType === 'url' ? input.sourceUrl : undefined,
    useAi: input.analysisLevel ? input.analysisLevel !== 'basic' : input.useAi === 'true',
    analysisLevel: input.analysisLevel,
    templateId: input.templateId,
  });
  if (input.sourceType === 'text')
    await store.addEvidence(c, Buffer.from(input.text!), {
      name: 'submitted-text.txt',
      mime: 'text/plain',
      kind: 'original',
      method: 'user-submitted-text',
    });
  if (input.sourceType === 'file')
    for (const file of prepared) {
      const name = file.name;
      await store.addEvidence(c, file.buffer, {
        name,
        mime: file.mime,
        kind: 'original',
        method: 'user-upload',
      });
    }
  await queue.add(c.id);
  return await store.get(c.id);
}
