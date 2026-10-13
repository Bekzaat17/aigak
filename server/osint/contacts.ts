import { randomUUID } from 'node:crypto';
import { maskPersonalIds, type OsintObservation } from '../../shared/osint.ts';
import type { Evidence } from '../../shared/types.ts';

const patterns: {
  kind: string;
  expression: RegExp;
  group?: number;
  status: OsintObservation['status'];
}[] = [
  {
    kind: 'email',
    expression: /[A-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[A-Z0-9](?:[A-Z0-9.-]*[A-Z0-9])?\.[A-Z]{2,63}/giu,
    status: 'observed',
  },
  {
    kind: 'phone',
    expression: /(?<!\d)(?:\+7|8)[ ()-]*\d{3}[ ()-]*\d{3}[ -]*\d{2}[ -]*\d{2}(?!\d)/gu,
    status: 'observed',
  },
  {
    kind: 'business_id',
    expression: /(?:БИН|БСН|BIN)[ \t]*[:№-]?[ \t]*(\d{12})(?!\d)/giu,
    group: 1,
    status: 'claimed',
  },
  {
    kind: 'sensitive_identifier',
    expression: /(?:ИИН|ЖСН|IIN)[ \t]*[:№-]?[ \t]*(\d{12})(?!\d)/giu,
    group: 1,
    status: 'masked',
  },
  {
    kind: 'organization',
    expression: /(?:ТОО|ЖШС|ООО|АО|LLP|LLC)[ \t]+[«"“][^»"”\n]{2,150}[»"”]/gu,
    status: 'claimed',
  },
  {
    kind: 'address',
    expression: /(?:юридический адрес|мекенжайы?|address)[ \t]*:[ \t]*[^\n]{5,200}/giu,
    status: 'claimed',
  },
  {
    kind: 'license',
    expression:
      /(?:лицензия|лицензии|лицензиясы|license)[ \t]*(?:№|number|номер|нөмірі|:)[ \t]*[A-ZА-Я0-9][A-ZА-Я0-9 /-]{2,60}/giu,
    status: 'claimed',
  },
  {
    kind: 'social',
    expression:
      /https?:\/\/(?:t\.me|telegram\.me|(?:www\.)?(?:instagram\.com|facebook\.com|vk\.com|youtube\.com|tiktok\.com))\/[A-Z0-9_./@?=&%-]+/giu,
    status: 'observed',
  },
];
export function extractContacts(evidence: Evidence[]): OsintObservation[] {
  const output: OsintObservation[] = [];
  const seen = new Set<string>();
  for (const e of evidence) {
    if (!e.text || e.kind === 'metadata') continue;
    for (const rule of patterns) {
      let count = 0;
      for (const m of e.text.matchAll(rule.expression)) {
        if (count++ >= 20) break;
        const raw = rule.group ? m[rule.group] : m[0];
        const key = rule.kind + '|' + raw.toLowerCase() + '|' + (e.sourceUrl || e.parentId || e.id);
        if (seen.has(key)) continue;
        seen.add(key);
        const start = m.index!,
          end = start + m[0].length;
        output.push({
          id: randomUUID(),
          kind: rule.kind,
          value: rule.status === 'masked' ? '[скрыто / жасырылған]' : maskPersonalIds(raw),
          evidenceId: e.id,
          sourceUrl: e.sourceUrl,
          collectedAt: e.createdAt,
          collector: 'contacts@1.0.0',
          status: rule.status,
          quote: maskPersonalIds(
            e.text.slice(Math.max(0, start - 40), Math.min(e.text.length, end + 60)),
          ),
          start,
          end,
        });
      }
    }
  }
  return output;
}
