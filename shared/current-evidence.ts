import type { CaseRecord, Evidence } from './types.ts';

/** Retain historical originals in the archive, but do not analyze an obsolete capture again. */
export function currentEvidence(c: Pick<CaseRecord, 'evidence' | 'collection'>): Evidence[] {
  if (!c.collection) return c.evidence;
  const active = new Set(c.collection.attempts.flatMap((a) => a.evidenceIds));
  const captures = new Set(
    c.evidence
      .filter(
        (e) =>
          e.method === 'http-get' ||
          e.method.startsWith('playwright') ||
          e.method.startsWith('authenticated-'),
      )
      .map((e) => e.id),
  );
  return c.evidence.filter((e) => {
    if (e.method === 'finding-screenshot' && e.capture && active.has(e.capture.textEvidenceId))
      return true;
    let item: Evidence | undefined = e;
    const seen = new Set<string>();
    while (item && !seen.has(item.id)) {
      seen.add(item.id);
      if (captures.has(item.id)) return active.has(e.id);
      item = c.evidence.find((parent) => parent.id === item?.parentId);
    }
    return true;
  });
}
