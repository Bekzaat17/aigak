import { load } from 'cheerio';
import { parsePublicUrl, safeFetch } from '../../network';
import type {
  Artifact,
  CollectorResult,
  DomainCollector,
  DomainTarget,
  ObservationDraft,
} from '../contracts';

/** Standard public discovery, useful even when the home page cannot be rendered. */
export class SitemapCollector implements DomainCollector {
  readonly id = 'sitemap';
  readonly version = '1.0.0';
  constructor(private readonly fetcher = safeFetch) {}
  async collect(target: DomainTarget, signal: AbortSignal): Promise<CollectorResult> {
    const origin = new URL(target.url).origin;
    const queue = [origin + '/robots.txt', origin + '/sitemap.xml'];
    const visited = new Set<string>();
    const pages = new Set<string>();
    const artifacts: Artifact[] = [];
    const observations: ObservationDraft[] = [];
    const sameOrigin = (raw: string) => {
      try {
        const u = parsePublicUrl(new URL(raw, origin).href);
        return u.origin === origin && !u.search ? u.href : undefined;
      } catch {
        return undefined;
      }
    };
    while (queue.length && visited.size < 4 && pages.size < 100) {
      signal.throwIfAborted();
      const url = queue.shift()!;
      if (visited.has(url)) continue;
      visited.add(url);
      try {
        const result = await this.fetcher(
          url,
          1024 * 1024,
          0,
          AbortSignal.any([signal, AbortSignal.timeout(6000)]),
        );
        if (result.status !== 200 || new URL(result.url).origin !== origin) continue;
        const text = result.body.toString();
        const robot = new URL(url).pathname === '/robots.txt';
        if (
          robot
            ? /<html/i.test(text)
            : !/<(?:urlset|sitemapindex)[\s>]/i.test(text) || /<!DOCTYPE/i.test(text)
        )
          continue;
        const artifact = artifacts.length;
        artifacts.push({
          name: robot ? 'robots.txt' : 'sitemap.xml',
          mime: robot ? 'text/plain' : 'application/xml',
          bytes: result.body,
          sourceUrl: result.url,
        });
        if (robot) {
          for (const m of text.matchAll(/^Sitemap:\s*(\S+)/gim)) {
            const u = sameOrigin(m[1]);
            if (u && queue.length < 8) queue.push(u);
          }
        } else {
          const $ = load(text, { xmlMode: true });
          $('sitemap > loc').each((_, e) => {
            const u = sameOrigin($(e).text().trim());
            if (u && queue.length < 8) queue.push(u);
          });
          $('url > loc').each((_, e) => {
            const u = sameOrigin($(e).text().trim());
            if (!u || pages.has(u) || pages.size >= 100) return;
            pages.add(u);
            observations.push({
              artifact,
              kind: 'published_page_url',
              value: u,
              sourceUrl: result.url,
              status: 'observed',
            });
          });
        }
      } catch {
        signal.throwIfAborted();
      }
    }
    return {
      status: artifacts.length ? 'completed' : 'partial',
      artifacts,
      observations,
      summary: {
        ru: `Опубликованные карты сайта: ${artifacts.length} источников, ${pages.size} адресов. Адрес из sitemap — кандидат для посещения, не доказательство содержания.`,
        kk: `Жария сайт карталары: ${artifacts.length} дереккөз, ${pages.size} мекенжай. Sitemap мекенжайы мазмұнның дәлелі емес.`,
      },
    };
  }
}
