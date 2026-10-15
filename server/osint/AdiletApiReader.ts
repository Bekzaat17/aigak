import { z } from 'zod';
import { safeFetch, safePostJson } from '../network';
import type { LegalSource } from './legal-catalog';
import type { LegalSourceReader } from './legal-source-reader';

const documentSchema = z.object({
  id: z.string().uuid(),
  group_number: z.string(),
  title_ru: z.string(),
  title_kz: z.string(),
  language: z.string(),
  is_actual: z.boolean(),
  in_force: z.boolean(),
});
const escape = (s: string) =>
  s.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;');

/** Public search resolves legacy act IDs to current document UUIDs; never accepts a fuzzy match. */
export class AdiletApiReader implements LegalSourceReader {
  readonly id = 'adilet-public-api';
  constructor(
    private readonly get = safeFetch,
    private readonly post = safePostJson,
  ) {}
  async read(source: LegalSource, signal: AbortSignal) {
    const search = await this.post(
      'https://adilet.zan.kz/api/search',
      {
        query: source.title.ru,
        filters: { language: 'rus', group_number: source.id },
        page: 1,
        page_size: 30,
        enable_highlighting: false,
      },
      signal,
    );
    if (search.status !== 200) throw Error('LAW_SEARCH_UNAVAILABLE');
    const results = z
      .object({ results: z.array(z.unknown()) })
      .parse(JSON.parse(search.body.toString()));
    const matches = results.results.flatMap((value) => {
      const parsed = documentSchema.safeParse(value);
      if (!parsed.success) return [];
      const d = parsed.data;
      return d.group_number === source.id &&
        d.language === 'rus' &&
        d.is_actual &&
        d.in_force &&
        d.title_kz.includes(source.identity)
        ? [d]
        : [];
    });
    if (matches.length !== 1) throw Error('LAW_IDENTITY_AMBIGUOUS');
    const document = matches[0];
    const contentUrl = `https://adilet.zan.kz/api/documents/${document.id}/content`;
    const response = await this.get(contentUrl, 12 * 1024 * 1024, 0, signal);
    if (response.status !== 200) throw Error('LAW_CONTENT_UNAVAILABLE');
    const content = z
      .object({ document_id: z.string(), text_content: z.string().min(100) })
      .parse(JSON.parse(response.body.toString()));
    if (content.document_id !== document.id) throw Error('LAW_IDENTITY_MISMATCH');
    return {
      html: `<html><body><h1>${escape(document.title_ru)}</h1><p>${escape(document.title_kz)}</p>${content.text_content}</body></html>`,
      artifact: {
        name: `${source.id}-official.json`,
        mime: 'application/json',
        bytes: Buffer.from(
          JSON.stringify({ searchUrl: search.url, contentUrl, document, content }),
        ),
        sourceUrl: `https://adilet.zan.kz/rus/docs/${document.id}`,
      },
    };
  }
}
