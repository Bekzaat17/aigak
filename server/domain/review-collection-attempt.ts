import { pageTextQuality } from '../../shared/collection';
import type { Evidence } from '../../shared/types';

/** Content availability only. Findings, legality and visual proof have separate checks. */
export function reviewCollectionAttempt(evidence: readonly Evidence[], errorCode?: string) {
  const texts = evidence.filter((e) => e.kind === 'text' && e.text).map((e) => e.text!);
  const adequate =
    errorCode !== 'CAPTCHA_REQUIRED' &&
    errorCode !== 'HTTP_ERROR' &&
    texts.some((text) => pageTextQuality(text) === 'adequate');
  const status: 'adequate' | 'limited' | 'failed' = adequate
    ? 'adequate'
    : errorCode
      ? 'failed'
      : 'limited';
  return { status, textLength: Math.max(0, ...texts.map((text) => text.length)) };
}
