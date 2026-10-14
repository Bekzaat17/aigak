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
  status: 'adequate' | 'limited' | 'unavailable';
  attempts: CollectionAttempt[];
}
/** A quality gate, not proof that every page of a site was inspected. */
export function pageTextQuality(text: string): 'adequate' | 'limited' {
  const clean = text.trim();
  const challenge =
    /^(just a moment|access denied|checking your browser|verify you are human|доступ запрещен|проверка браузера)/i;
  return clean.length >= 240 && clean.split(/\s+/u).length >= 30 && !challenge.test(clean)
    ? 'adequate'
    : 'limited';
}
