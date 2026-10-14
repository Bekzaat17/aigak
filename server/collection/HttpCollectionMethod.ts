import { load } from 'cheerio';
import type { CaseRecord } from '../../shared/types.ts';
import { safeFetch } from '../network.ts';
import type {
  CollectionStorage,
  EvidenceExtractor,
  UrlCollectionMethod,
} from '../collection/contracts.ts';

import { detectMime } from './detect-mime.ts';
import { issue } from './text-evidence.ts';

export class HttpCollectionMethod implements UrlCollectionMethod {
  readonly id = 'http';
  constructor(
    private readonly store: Pick<CollectionStorage, 'addEvidence'>,
    private readonly extraction: EvidenceExtractor,
  ) {}
  async collect(c: CaseRecord, signal: AbortSignal) {
    const { store, extraction } = this;
    const result = await safeFetch(c.sourceUrl!, undefined, undefined, signal);
    c.redirects = result.redirects;
    const declared = String(result.headers['content-type'] || '').split(';')[0];
    const mime =
      declared === 'text/html'
        ? 'text/html'
        : detectMime(result.body, new URL(result.url).pathname);
    const ext = mime === 'text/html' ? 'html' : mime === 'application/pdf' ? 'pdf' : 'bin';
    const original = await store.addEvidence(c, result.body, {
      name: `response.${ext}`,
      mime,
      kind: 'original',
      method: 'http-get',
      sourceUrl: result.url,
    });
    await store.addEvidence(
      c,
      Buffer.from(
        JSON.stringify(
          {
            requestedUrl: c.sourceUrl,
            finalUrl: result.url,
            status: result.status,
            headers: result.headers,
            redirects: result.redirects,
            receivedAt: original.createdAt,
          },
          null,
          2,
        ),
      ),
      {
        name: 'http-metadata.json',
        mime: 'application/json',
        kind: 'metadata',
        method: 'http-get',
        parentId: original.id,
      },
    );
    if (result.status >= 400)
      issue(
        c,
        `Сервер вернул HTTP ${result.status}; содержимое может быть страницей ошибки.`,
        `Сервер HTTP ${result.status} қайтарды; мазмұн қате беті болуы мүмкін.`,
      );
    await extraction.extract(c, original);
    if (mime !== 'text/html') return;
    const $ = load(result.body.toString());
    c.links = [
      ...new Set(
        $('a[href]')
          .map((_, a) => {
            try {
              const u = new URL($(a).attr('href')!, result.url);
              return ['http:', 'https:'].includes(u.protocol) ? u.href : '';
            } catch {
              return '';
            }
          })
          .get()
          .filter(Boolean),
      ),
    ].slice(0, 30);
  }
}
