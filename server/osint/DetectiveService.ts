import { load } from 'cheerio';
import { randomUUID } from 'node:crypto';
import type { OsintReport, ResourceRelation } from '../../shared/osint.ts';
import type { Evidence } from '../../shared/types.ts';
import type { DomainCollector, SaveArtifact } from './contracts.ts';
import { domainTarget } from './domain.ts';
import { DnsCollector } from './providers.ts';

/** Builds technical relations from preserved sources. Never attributes an operator. */
export function discoverRelations(report: OsintReport, evidence: Evidence[]): ResourceRelation[] {
  const relations: ResourceRelation[] = [];
  const add = (from: string, to: string, kind: ResourceRelation['kind'], evidenceId: string) => {
    if (from === to) return;
    const existing = relations.find((r) => r.from === from && r.to === to && r.kind === kind);
    if (existing) {
      if (!existing.evidenceIds.includes(evidenceId)) existing.evidenceIds.push(evidenceId);
      return;
    }
    if (relations.length >= 100) return;
    relations.push({
      id: randomUUID(),
      from,
      to,
      kind,
      evidenceIds: [evidenceId],
      status: 'observed',
      checkedAt: new Date().toISOString(),
    });
  };
  if (!report.hostname) return relations;
  for (const o of report.observations) {
    if (o.kind === 'tls_names')
      for (const part of o.value.split(',')) {
        const name = part.trim().match(/^DNS:([a-z0-9.-]+)$/i)?.[1];
        if (!name) continue; // Wildcards are patterns, not discovered hosts.
        try {
          add(
            report.hostname,
            domainTarget('https://' + name).hostname,
            'certificate_contains',
            o.evidenceId,
          );
        } catch {
          /* Invalid/private names are not candidates. */
        }
      }
    if (['dns_A', 'dns_AAAA'].includes(o.kind)) {
      try {
        for (const ip of JSON.parse(o.value))
          if (typeof ip === 'string') add(report.hostname, ip, 'resolves_to', o.evidenceId);
      } catch {
        /* Invalid observation is not a relation. */
      }
    }
  }
  for (const e of evidence) {
    if (!e.sourceUrl || !e.text || e.mime !== 'text/html') continue;
    let from: string;
    try {
      from = domainTarget(e.sourceUrl).hostname;
    } catch {
      continue;
    }
    const $ = load(e.text);
    $('a[href]')
      .slice(0, 200)
      .each((_i, node) => {
        try {
          add(
            from,
            domainTarget(new URL($(node).attr('href')!, e.sourceUrl).href).hostname,
            'links_to',
            e.id,
          );
        } catch {
          /* Unsafe or non-web link. */
        }
      });
  }
  return relations;
}

/** Independent discovery service with a replaceable DNS port and explicit work budget. */
export class DetectiveService {
  constructor(
    private readonly dns: DomainCollector = new DnsCollector(),
    private readonly maxCandidates = 5,
    private readonly timeoutMs = 20000,
  ) {}
  async investigate(report: OsintReport, evidence: Evidence[], save: SaveArtifact): Promise<void> {
    const started = Date.now();
    report.relations = discoverRelations(report, evidence);
    const hosts = [
      ...new Set(
        report.relations.filter((r) => r.kind === 'certificate_contains').map((r) => r.to),
      ),
    ];
    report.candidates = hosts.map((hostname) => ({
      hostname,
      status: 'not_checked' as const,
      evidenceIds: [],
    }));
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeoutMs);
    try {
      for (const candidate of report.candidates.slice(0, this.maxCandidates)) {
        if (controller.signal.aborted) break;
        let abort = () => {};
        try {
          const result = await Promise.race([
            this.dns.collect(domainTarget('https://' + candidate.hostname), controller.signal),
            new Promise<never>((_, reject) => {
              abort = () => reject(new Error('DETECTIVE_TIMEOUT'));
              controller.signal.addEventListener('abort', abort, { once: true });
              if (controller.signal.aborted) abort();
            }),
          ]);
          const saved = [];
          for (const a of result.artifacts) {
            saved.push(
              await save(
                { ...a, name: 'candidate-' + candidate.hostname + '-' + a.name },
                'detective-dns@1.0.0',
              ),
            );
          }
          candidate.evidenceIds = saved.map((e) => e.id);
          candidate.status = result.status === 'completed' ? 'dns_checked' : 'unavailable';
          for (const o of result.observations.filter((o) =>
            ['dns_A', 'dns_AAAA'].includes(o.kind),
          )) {
            const source = saved[o.artifact];
            if (!source) throw new Error('MISSING_DNS_SOURCE');
            for (const ip of JSON.parse(o.value))
              if (typeof ip === 'string')
                report.relations.push({
                  id: randomUUID(),
                  from: candidate.hostname,
                  to: ip,
                  kind: 'resolves_to',
                  status: 'observed',
                  evidenceIds: [source.id],
                  checkedAt: source.createdAt,
                });
          }
        } catch {
          candidate.status = 'unavailable';
        } finally {
          controller.signal.removeEventListener('abort', abort);
        }
      }
    } finally {
      clearTimeout(timer);
      controller.abort();
    }
    const checked = report.candidates.filter((c) => c.status === 'dns_checked').length;
    report.stages.push({
      id: 'detective',
      version: '1.0.0',
      status: 'partial',
      durationMs: Date.now() - started,
      evidenceIds: [...new Set(report.relations.flatMap((r) => r.evidenceIds))],
      summary: {
        ru: `Технических связей: ${report.relations.length}. Кандидатов из сертификата: ${hosts.length}; DNS проверен: ${checked}, лимит ${this.maxCandidates}. Связи не доказывают общего владельца или зеркалирование. Этот этап проверяет DNS; результаты поиска и содержимого перечислены отдельно.`,
        kk: `Техникалық байланыстар: ${report.relations.length}. Сертификаттан үміткерлер: ${hosts.length}; DNS тексерілді: ${checked}, шегі ${this.maxCandidates}. Байланыстар ортақ иені не айна сайтты дәлелдемейді. Бұл кезең DNS тексереді; іздеу және мазмұн нәтижелері бөлек көрсетілген.`,
      },
    });
    report.status = 'partial';
  }
}
