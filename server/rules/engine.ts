import { randomUUID } from 'node:crypto';
import type { Evidence, Finding, Localized } from '../../shared/types.ts';
import { combinations, contexts, RULESET_VERSION, terms } from './catalog.ts';

type Match = { termId: string; start: number; end: number; text: string };
const WINDOW = 240;
const PER_RULE_LIMIT = 3;
// Unicode word boundaries prevent "ставка" inside "доставка" and "слот" inside "кислота".
function matches(text: string, id: string, expression: RegExp): Match[] {
  const regex = new RegExp(
    '(?<![\\p{L}\\p{N}_])(?:' + expression.source + ')(?![\\p{L}\\p{N}_])',
    'giu',
  );
  return Array.from(text.matchAll(regex), (m) => ({
    termId: id,
    start: m.index!,
    end: m.index! + m[0].length,
    text: m[0],
  }));
}
export function analyzeRules(evidence: Evidence[]): Finding[] {
  const findings: Finding[] = [];
  // Duplicate text in an original and its derived extraction is not independent corroboration.
  const seen = new Set<string>();
  for (const e of evidence) {
    const text = e.text;
    if (!text?.trim() || seen.has(text)) continue;
    seen.add(text);
    const hits = new Map(terms.map((r) => [r.id, matches(text, r.id, r.expression)]));
    const breaks = Array.from(text.matchAll(/\r?\n[ \t]*\r?\n/g));
    const contextHits = contexts.flatMap((r) =>
      matches(text, r.id, r.expression).map((m) => ({ r, m })),
    );
    function emit(
      id: string,
      category: string,
      title: Localized,
      explanation: Localized,
      selected: Match[],
      kind: 'term' | 'combination',
    ) {
      const first = Math.min(...selected.map((m) => m.start)),
        last = Math.max(...selected.map((m) => m.end));
      // A paragraph is the maximum context scope; windows never connect separate paragraphs.
      const previous = breaks.filter((m) => m.index! + m[0].length <= first).at(-1);
      const next = breaks.find((m) => m.index! >= last);
      const start = Math.max(previous ? previous.index! + previous[0].length : 0, first - 80);
      const end = Math.min(next?.index ?? text!.length, last + 100);
      const flags = contextHits
        .filter(({ m }) => m.start >= start && m.end <= end)
        .map(({ r, m }) => ({
          id: r.id,
          title: r.title,
          question: r.explanation,
          quote: m.text,
          start: m.start,
          end: m.end,
        }));
      const detail = { ru: explanation.ru, kk: explanation.kk };
      for (const lang of ['ru', 'kk'] as const) {
        detail[lang] +=
          '\n' + (lang === 'ru' ? 'Правило: ' : 'Ереже: ') + id + ' @ ' + RULESET_VERSION;
        for (const flag of flags)
          detail[lang] +=
            '\n' + flag.title[lang] + ': «' + flag.quote + '». ' + flag.question[lang];
      }
      findings.push({
        id: randomUUID(),
        category,
        title,
        explanation: detail,
        evidenceId: e.id,
        quote: text!.slice(start, end),
        start,
        end,
        engine: 'rules',
        decision: 'pending',
        rule: { id, version: RULESET_VERSION, kind, matches: selected, contexts: flags },
      });
    }
    for (const rule of terms) {
      for (const hit of hits.get(rule.id)!.slice(0, PER_RULE_LIMIT))
        emit(rule.id, rule.category, rule.title, rule.explanation, [hit], 'term');
    }
    for (const rule of combinations) {
      let emitted = 0;
      for (const anchor of hits.get(rule.requires[0]) || []) {
        const selected = [anchor];
        for (const id of rule.requires.slice(1)) {
          const hit = (hits.get(id) || []).find((m) => {
            const start = Math.min(m.start, ...selected.map((x) => x.start));
            const end = Math.max(m.end, ...selected.map((x) => x.end));
            return end - start <= WINDOW && !/\r?\n[ \t]*\r?\n/.test(text.slice(start, end));
          });
          if (hit) selected.push(hit);
        }
        if (selected.length !== rule.requires.length) continue;
        emit(rule.id, rule.category, rule.title, rule.explanation, selected, 'combination');
        if (++emitted === PER_RULE_LIMIT) break;
      }
    }
  }
  return findings;
}
