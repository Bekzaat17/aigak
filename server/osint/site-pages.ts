import { load } from 'cheerio';
import type { OsintStage } from '../../shared/osint.ts';
import type { CaseRecord, Evidence } from '../../shared/types.ts';
import { parsePublicUrl, safeFetch } from '../network.ts';
import type { CollectionStorage, EvidenceExtractor } from '../collection/contracts.ts';

export function contactPageLinks(html: string, base: string): string[] {
  const $ = load(html);
  const origin = new URL(base).origin;
  const links: string[] = [];
  $('a[href]').each((_, a) => {
    if (links.length >= 3) return;
    try {
      const u = parsePublicUrl(new URL($(a).attr('href')!, base).href);
      u.hash = '';
      const hint = $(a).text() + ' ' + decodeURIComponent(u.pathname);
      if (
        u.origin === origin &&
        u.href !== base &&
        !u.search &&
        /(?:contact|about|legal|terms|privacy|license|requisite|контакт|реквизит|лицензи|о-компании|байланыс|деректеме)/iu.test(
          hint,
        ) &&
        !links.includes(u.href)
      )
        links.push(u.href);
    } catch {
      // Malformed or non-public candidate URLs are excluded.
    }
  });
  return links;
}
function extractLinkedContacts(store: CollectionStorage, c: CaseRecord, e: Evidence, html: string) {
  const $ = load(html);
  const links = [
    ...new Set(
      $('a[href]')
        .map((_, a) => $(a).attr('href') || '')
        .get()
        .filter((h) =>
          /^(?:mailto:|tel:|https?:\/\/(?:t\.me|telegram\.me|(?:www\.)?(?:instagram\.com|facebook\.com|vk\.com|youtube\.com|tiktok\.com))\/)/i.test(
            h,
          ),
        ),
    ),
  ].slice(0, 60);
  if (!links.length) return;
  const text = links.join('\n');
  store.addEvidence(c, Buffer.from(text), {
    name: 'contact-links.txt',
    mime: 'text/plain',
    kind: 'text',
    method: 'osint-html-links@1.0.0',
    parentId: e.id,
    sourceUrl: e.sourceUrl,
    text,
  });
}
/** Application adapter: bounded same-origin pages; raw bytes and derived text remain separate evidence. */
export async function collectContactPages(
  store: CollectionStorage,
  c: CaseRecord,
  extraction: EvidenceExtractor,
): Promise<OsintStage> {
  const start = Date.now();
  const evidenceIds: string[] = [];
  const initial = c.evidence.filter((e) => e.mime === 'text/html');
  for (const e of initial) extractLinkedContacts(store, c, e, store.read(c, e).toString());
  const source =
    initial.find((e) => e.method === 'playwright-dom') ||
    initial.find((e) => e.method === 'http-get');
  if (!source?.sourceUrl)
    return {
      id: 'contact-pages',
      version: '1.0.0',
      status: 'skipped',
      durationMs: Date.now() - start,
      evidenceIds,
      summary: {
        ru: 'Веб-страница с подтверждённым URL отсутствует; внешние страницы контактов не запрашивались.',
        kk: 'Расталған URL бар веб-бет жоқ; сыртқы байланыс беттері сұралмады.',
      },
    };
  const urls = contactPageLinks(store.read(c, source).toString(), source.sourceUrl);
  const signal = AbortSignal.timeout(30000);
  let failed = 0;
  for (const url of urls) {
    try {
      const result = await safeFetch(url, 1024 * 1024, 0, signal);
      if (
        result.status !== 200 ||
        !String(result.headers['content-type']).toLowerCase().startsWith('text/html')
      )
        throw Error('PAGE_UNAVAILABLE');
      const e = store.addEvidence(c, result.body, {
        name: 'contact-page.html',
        mime: 'text/html',
        kind: 'original',
        method: 'osint-contact-page@1.0.0',
        sourceUrl: result.url,
      });
      evidenceIds.push(e.id);
      extractLinkedContacts(store, c, e, result.body.toString());
      await extraction.extract(c, e);
    } catch {
      failed++;
    }
  }
  return {
    id: 'contact-pages',
    version: '1.0.0',
    status: failed ? 'partial' : 'completed',
    durationMs: Date.now() - start,
    evidenceIds,
    summary: {
      ru: `Дополнительные страницы контактов: ${urls.length - failed}/${urls.length}. До 3 опубликованных ссылок того же origin, без перехода по редиректам.`,
      kk: `Қосымша байланыс беттері: ${urls.length - failed}/${urls.length}. Сол origin ішіндегі 3 жарияланған сілтемеге дейін, редиректсіз.`,
    },
  };
}
