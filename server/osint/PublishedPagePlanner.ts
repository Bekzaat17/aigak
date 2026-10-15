import { load } from 'cheerio';
import { currentEvidence } from '../../shared/current-evidence';
import type { CaseRecord } from '../../shared/types';
import type { PagePlanner, PageRequest } from '../application/ports/page-exploration';
import type { CaseStore } from '../application/ports/storage';
import { parsePublicUrl } from '../network';

/** Published public pages only: same origin, no forms, account actions or guessed paths. */
export class PublishedPagePlanner implements PagePlanner {
  constructor(
    private readonly store: Pick<CaseStore, 'read'>,
    private readonly profile: 'site' | 'legal' = 'legal',
  ) {}
  plan(record: CaseRecord): PageRequest[] {
    if (!record.sourceUrl) return [];
    const origin = new URL(record.sourceUrl).origin;
    const evidence = currentEvidence(record);
    const adequate = new Set(
      record.collection?.attempts
        .filter((a) => a.status === 'adequate')
        .flatMap((a) => a.evidenceIds) || [],
    );
    const already = new Set([
      new URL(record.sourceUrl).href,
      ...evidence
        .filter((e) => e.text?.trim() && (adequate.has(e.id) || e.method.startsWith('osint-')))
        .map((e) => e.sourceUrl),
    ]);
    const requests = new Map<string, PageRequest>();
    const add = (raw: string, base: string, label: string) => {
      try {
        const u = parsePublicUrl(new URL(raw, base).href);
        if (!/^#!?\//.test(u.hash)) u.hash = '';
        const route = decodeURIComponent(u.pathname + u.hash);
        if (
          u.origin !== origin ||
          u.search ||
          already.has(u.href) ||
          /(?:login|logout|register|deposit|withdraw|delete|account|bet\/|ставк|auth|wallet|cashier|password|reset|checkout|purchase|sign-in|sign-up)/iu.test(
            route,
          ) ||
          (this.profile === 'legal' &&
            !/(?:(?:^|[\s/#-])(?:license|licence|terms|rules|privacy|personal-data)(?:$|[\s/#.?-])|лицензи|правил|политик|услови)/iu.test(
              route,
            ) &&
            !/(?:terms and conditions|privacy policy|лицензи|политик|соглашени|правила (?:при[её]ма|участи|игр)|условия (?:участи|использова))/iu.test(
              label,
            )) ||
          /\.(?:png|jpg|jpeg|gif|svg|css|js|zip|exe|apk|mp4)$/i.test(u.pathname)
        )
          return;
        requests.set(u.href, {
          url: u.href,
          purpose: {
            ru: 'Проверить содержимое опубликованной внутренней страницы и условия предложения.',
            kk: 'Жарияланған ішкі беттің мазмұнын және ұсыныс шарттарын тексеру.',
          },
        });
      } catch {
        /* Invalid or non-public links are not collection requests. */
      }
    };
    for (const e of evidence.filter((e) => e.mime === 'text/html' && e.sourceUrl)) {
      if (record.collection && !adequate.has(e.id) && !e.method.startsWith('osint-')) continue;
      if (new URL(e.sourceUrl!).origin !== origin) continue;
      const $ = load(this.store.read(record, e).toString());
      $('a[href]').each((_, a) => add($(a).attr('href')!, e.sourceUrl!, $(a).text()));
    }
    for (const o of record.osint?.observations || []) {
      if (o.kind === 'published_page_url' && evidence.some((e) => e.id === o.evidenceId))
        add(o.value, origin, '');
    }
    return [...requests.values()]
      .sort((a, b) => {
        const priority = (url: string) =>
          /(?:casino|slots|games|promo|bonus|акци|казино|sport)/iu.test(url)
            ? 0
            : /(?:terms|rules|privacy|license)/iu.test(url)
              ? 1
              : 2;
        return priority(a.url) - priority(b.url);
      })
      .slice(0, this.profile === 'legal' ? 2 : 100);
  }
}
