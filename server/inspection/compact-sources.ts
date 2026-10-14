import type { Evidence } from '../../shared/types.ts';

/** Lossless transport compression: keep attribution, share only byte-identical text. */
export function compactSources(evidence: Evidence[]) {
  const textOwners = new Map<string, string>();
  return evidence
    .filter((source) => source.text?.trim())
    .map((source) => {
      const text = source.text!;
      const owner = textOwners.get(text);
      const identity = { id: source.id, sourceUrl: source.sourceUrl };
      // A reference costs more than a very short repeated text.
      if (owner !== undefined && text.length > owner.length + 16)
        return { ...identity, textRef: owner };
      textOwners.set(text, source.id);
      return { ...identity, text };
    });
}
