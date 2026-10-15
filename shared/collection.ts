export interface CollectionAttempt {
  method: string;
  startedAt: string;
  durationMs: number;
  status: 'adequate' | 'limited' | 'failed';
  textLength: number;
  evidenceIds: string[];
  errorCode?: string;
}
export interface CollectionReport {
  budgetMs?: number;
  status: 'adequate' | 'limited' | 'unavailable';
  attempts: CollectionAttempt[];
}
/** A quality gate, not proof that every page of a site was inspected. */
export function pageTextQuality(text: string): 'adequate' | 'limited' {
  const clean = text.trim();
  const challenge =
    /^(just a moment|access denied|checking your browser|verify you are human|один момент|доступ запрещен|проверка браузера)/i;
  return clean.length >= 240 &&
    clean.split(/\s+/u).length >= 30 &&
    !challenge.test(clean) &&
    !/выполнение проверки безопасности|проверяет, что вы не бот|проверяем, человек ли вы|verify (that )?you are human|performing security verification/i.test(
      clean,
    )
    ? 'adequate'
    : 'limited';
}
