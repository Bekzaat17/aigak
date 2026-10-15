import type { LegalNorm } from '../../shared/osint';
import { AiError } from './contracts';

export interface LegalCitation {
  id: string;
  normId: string;
  text: string;
}
/** All passages remain ordered and contiguous excerpts; models select IDs, not invented quotations. */
export function legalCitations(norms: LegalNorm[]): LegalCitation[] {
  return norms.flatMap((norm, n) => {
    const citations: LegalCitation[] = [];
    let start = 0;
    while (start < norm.quote.length) {
      let end = Math.min(start + 600, norm.quote.length);
      if (end < norm.quote.length) {
        const paragraph = norm.quote.lastIndexOf('\n', end);
        const space = norm.quote.lastIndexOf(' ', end);
        if (paragraph > start + 80) end = paragraph;
        else if (space > start) end = space;
      }
      const text = norm.quote.slice(start, end).trim();
      if (text.length) citations.push({ id: `n${n}p${citations.length}`, normId: norm.id, text });
      start = end;
      while (/\s/.test(norm.quote[start] || '') && start < norm.quote.length) start++;
    }
    return citations;
  });
}

export function resolveLegalCitations(text: string, citations: LegalCitation[]): string {
  const parsed: unknown = JSON.parse(text);
  if (
    !parsed ||
    typeof parsed !== 'object' ||
    !('hypotheses' in parsed) ||
    !Array.isArray(parsed.hypotheses)
  )
    throw new AiError('AI_INVALID_RESPONSE');
  const hypotheses = parsed.hypotheses.map((h: unknown) => {
    if (!h || typeof h !== 'object' || !('citationId' in h) || !('normId' in h))
      throw new AiError('AI_INVALID_RESPONSE');
    const citation = citations.find((c) => c.id === h.citationId && c.normId === h.normId);
    if (!citation) throw new AiError('AI_UNGROUNDED');
    const { citationId: _id, ...rest } = h;
    void _id;
    return { ...rest, normQuote: citation.text };
  });
  return JSON.stringify({ ...parsed, hypotheses });
}
