import type { CaseRecord, Evidence } from '../../shared/types.ts';
import type { CollectionStorage } from './contracts.ts';

export const maxText = 180000;

export function issue(c: CaseRecord, ru: string, kk: string) {
  c.issues.push({ ru, kk });
}

export async function saveText(
  store: CollectionStorage,
  c: CaseRecord,
  e: Evidence,
  text: string,
  method: string,
) {
  if (!text.trim()) {
    issue(
      c,
      `${e.name}: извлекаемый текст не найден. Нужна ручная проверка.`,
      `${e.name}: мәтін алынбады. Қолмен тексеру қажет.`,
    );
    return;
  }
  if (text.length > maxText)
    issue(
      c,
      `${e.name}: анализ ограничен первыми ${maxText} символами.`,
      `${e.name}: талдау алғашқы ${maxText} таңбамен шектелді.`,
    );
  const limited = text.slice(0, maxText);
  await store.addEvidence(c, Buffer.from(limited), {
    name: `${e.name}.txt`,
    mime: 'text/plain',
    kind: 'text',
    method,
    parentId: e.id,
    text: limited,
    sourceUrl: e.sourceUrl,
  });
}
