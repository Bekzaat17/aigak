import { z } from 'zod';
import { safeFetch } from '../../network';
import type {
  DomainCollector,
  DomainTarget,
  CollectorResult,
  ObservationDraft,
  Artifact,
} from '../contracts';
const snapshot = z.object({
  available: z.boolean(),
  timestamp: z.string().regex(/^\d{14}$/),
  url: z.string().url(),
  status: z.string(),
});
export function archiveSnapshot(data: unknown, domain: string) {
  const parsed = z
    .object({ archived_snapshots: z.object({ closest: snapshot.optional() }) })
    .parse(data);
  const s = parsed.archived_snapshots.closest;
  if (!s?.available || s.status !== '200') return undefined;
  const u = new URL(s.url);
  if (
    !['http:', 'https:'].includes(u.protocol) ||
    u.hostname !== 'web.archive.org' ||
    u.username ||
    u.password
  )
    throw Error('ARCHIVE_SOURCE_MISMATCH');
  const match = u.pathname.match(/^\/web\/(\d{14})\/(https?:\/\/.+)$/);
  if (!match || match[1] !== s.timestamp) throw Error('ARCHIVE_TIMESTAMP_MISMATCH');
  const original = new URL(match[2]);
  if (original.hostname.replace(/^www\./, '') !== domain.replace(/^www\./, ''))
    throw Error('ARCHIVE_DOMAIN_MISMATCH');
  u.protocol = 'https:';
  return {
    date: `${s.timestamp.slice(0, 4)}-${s.timestamp.slice(4, 6)}-${s.timestamp.slice(6, 8)}`,
    url: u.href,
  };
}
/** Samples three past dates. Metadata is a historical lead, never current-content proof. */
export class ArchiveHistoryCollector implements DomainCollector {
  readonly id = 'archive-history';
  readonly version = '1.0.0';
  constructor(
    private readonly fetcher = safeFetch,
    private readonly year = () => new Date().getUTCFullYear(),
  ) {}
  async collect(target: DomainTarget, signal: AbortSignal): Promise<CollectorResult> {
    const domain = target.registrationDomain || target.hostname;
    const outcomes = await Promise.allSettled(
      [1, 3, 5].map(async (age) => {
        const url =
          'https://archive.org/wayback/available?url=' +
          encodeURIComponent('https://' + domain + '/') +
          '&timestamp=' +
          (this.year() - age) +
          '0101';
        const response = await this.fetcher(url, 1024 * 1024, 2, signal);
        if (response.status !== 200) throw Error('ARCHIVE_UNAVAILABLE');
        return {
          response,
          snapshot: archiveSnapshot(JSON.parse(response.body.toString()), domain),
        };
      }),
    );
    signal.throwIfAborted();
    const artifacts: Artifact[] = [],
      observations: ObservationDraft[] = [];
    const seen = new Set<string>();
    for (const outcome of outcomes) {
      if (outcome.status !== 'fulfilled') continue;
      const { response, snapshot: s } = outcome.value;
      const artifact = artifacts.length;
      artifacts.push({
        name: `archive-query-${artifact + 1}.json`,
        mime: 'application/json',
        bytes: response.body,
        sourceUrl: response.url,
      });
      if (s && !seen.has(s.url)) {
        seen.add(s.url);
        observations.push({
          artifact,
          kind: 'archive_snapshot',
          value: JSON.stringify(s),
          status: 'observed',
        });
      }
    }
    if (!artifacts.length) throw Error('ARCHIVE_UNAVAILABLE');
    return {
      status: artifacts.length === 3 ? 'completed' : 'partial',
      artifacts,
      observations,
      summary: {
        ru: `Архив: найдены ссылки на ${observations.length} снимков; ответы ${artifacts.length} из 3 запросов к прошлым датам. Это выборка ближайших доступных копий, не полная история. Содержимое архивных страниц не проверялось.`,
        kk: `Мұрағат: ${observations.length} көшірме сілтемесі табылды; өткен күндерге 3 сұраудан ${artifacts.length} жауап. Бұл ең жақын көшірмелер іріктемесі, толық тарих емес. Мұрағат беттерінің мазмұны тексерілмеді.`,
      },
    };
  }
}
