import type { CaseRecord } from '../../../shared/types';
/** Only describe saved responses from the current collection, not inferred operator intent. */
export function accessSignals(c: CaseRecord) {
  const ids = new Set(c.collection?.attempts.flatMap((a) => a.evidenceIds) || []);
  const challenges = c.evidence.filter(
    (e) =>
      ids.has(e.id) &&
      e.kind === 'text' &&
      /^(?:just a moment|access denied|checking your browser|verify you are human|проверка браузера|доступ запрещ[её]н)/iu.test(
        e.text?.trim() || '',
      ),
  );
  const requested = c.osint?.requestedUrl;
  const final = c.osint?.finalUrl;
  const changedAddress =
    requested && final && requested !== final ? { requested, final } : undefined;
  return { challenges, changedAddress };
}
