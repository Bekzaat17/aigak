import { z } from 'zod';
import { busyStatuses } from '../../../shared/types.ts';
import { detectMime } from '../../domain/detect-mime.ts';
import type { IntakeDependencies, UploadedFile } from './contracts.ts';
export function addMaterials(
  { store }: Pick<IntakeDependencies, 'store'>,
  id: string,
  textInput: unknown,
  files: UploadedFile[],
) {
  const c = store.get(String(id));
  if (!c) throw Error('NOT_FOUND');
  if (busyStatuses.includes(c.status)) throw Error('CASE_BUSY');
  const text = z.string().max(180000).default('').parse(textInput);

  if (!text.trim() && !files.length) throw Error('EMPTY_INPUT');
  const prepared = files.map((file) => {
    const name = file.name;
    return { file, name, mime: detectMime(file.buffer, name) };
  });
  c.status = 'review';
  delete c.reviewedAt;
  if (text.trim())
    store.addEvidence(c, Buffer.from(text), {
      name: 'additional-text.txt',
      mime: 'text/plain',
      kind: 'original',
      method: 'inspector-addition',
    });
  for (const { file, name, mime } of prepared)
    store.addEvidence(c, file.buffer, {
      name,
      mime,
      kind: 'original',
      method: 'inspector-addition',
    });
  c.materialsPending = true;
  store.event(c, 'materials.added');
  return c;
}
