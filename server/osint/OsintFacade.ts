import { randomUUID } from 'node:crypto';
import type { OsintReport, OsintStage } from '../../shared/osint.ts';
import { extractContacts } from './contacts.ts';
import type { DomainCollector, OsintInput, SaveArtifact } from './contracts.ts';
import { domainTarget } from './domain.ts';

/** Collectors know protocols; the facade knows execution and provenance, never the database. */
export class OsintFacade {
  constructor(
    private readonly collectors: DomainCollector[],
    private readonly timeoutMs = 45000,
  ) {
    if (new Set(collectors.map((c) => c.id)).size !== collectors.length)
      throw new Error('DUPLICATE_OSINT_COLLECTOR');
  }
  async inspect(
    input: OsintInput,
    save: SaveArtifact,
    externalSignal?: AbortSignal,
  ): Promise<OsintReport> {
    const observations = extractContacts(input.evidence);
    const report: OsintReport = {
      version: '1.0.0',
      status: 'completed',
      requestedUrl: input.url,
      finalUrl: input.finalUrl || input.url,
      observations,
      stages: [
        {
          id: 'contacts',
          version: '1.0.0',
          status: 'completed',
          durationMs: 0,
          evidenceIds: [...new Set(observations.map((o) => o.evidenceId))],
          summary: {
            ru: 'Публичные контакты и заявленные реквизиты извлечены из материалов; принадлежность не подтверждена. До 20 совпадений каждого вида на материал.',
            kk: 'Материалдардан ашық байланыстар мен көрсетілген деректемелер алынды; тиесілілігі расталмады. Әр материалда әр түрдің 20 сәйкестігіне дейін.',
          },
        },
      ],
    };
    if (!report.finalUrl) {
      report.status = 'partial';
      report.stages.push({
        id: 'domain',
        version: '1.0.0',
        status: 'skipped',
        durationMs: 0,
        evidenceIds: [],
        summary: {
          ru: 'URL не задан. Домен по тексту или скриншоту не устанавливался.',
          kk: 'URL берілмеді. Мәтін не скриншот бойынша домен анықталмады.',
        },
      });
      return report;
    }
    const target = domainTarget(report.finalUrl);
    Object.assign(report, {
      hostname: target.hostname,
      unicodeHostname: target.unicodeHostname,
      registrationDomain: target.registrationDomain,
      siteDomain: target.siteDomain,
    });
    const controller = new AbortController();
    const signal = externalSignal
      ? AbortSignal.any([controller.signal, externalSignal])
      : controller.signal;
    const timer = setTimeout(() => controller.abort(), this.timeoutMs);
    try {
      // No store mutations in parallel: gather provider outputs, then persist in registry order.
      const results = await Promise.allSettled(
        this.collectors.map(async (collector) => {
          const start = Date.now();
          let abort = () => {};
          try {
            const result = await Promise.race([
              collector.collect(target, signal),
              new Promise<never>((_, reject) => {
                abort = () => reject(new Error('OSINT_TIMEOUT'));
                signal.addEventListener('abort', abort, { once: true });
                if (signal.aborted) abort();
              }),
            ]);
            return { result, durationMs: Date.now() - start };
          } finally {
            signal.removeEventListener('abort', abort);
          }
        }),
      );
      externalSignal?.throwIfAborted();
      for (let i = 0; i < results.length; i++) {
        const collector = this.collectors[i],
          outcome = results[i];
        const stage: OsintStage = {
          id: collector.id,
          version: collector.version,
          status: 'failed',
          durationMs: 0,
          evidenceIds: [],
          summary: {
            ru: 'Источник недоступен или ответ не прошёл проверку. Данные не установлены.',
            kk: 'Дереккөз қолжетімсіз немесе жауап тексеруден өтпеді. Деректер анықталмады.',
          },
        };
        if (outcome.status === 'fulfilled') {
          const { result, durationMs } = outcome.value;
          const saved = [];
          for (const a of result.artifacts) {
            saved.push(await save(a, collector.id + '@' + collector.version));
          }
          stage.status = result.status;
          stage.summary = result.summary;
          stage.durationMs = durationMs;
          stage.evidenceIds = saved.map((e) => e.id);
          for (const draft of result.observations) {
            const { artifact, ...observation } = draft;
            const source = saved[artifact];
            if (!source) throw new Error('OSINT_PROVENANCE_MISSING');
            report.observations.push({
              ...observation,
              id: randomUUID(),
              evidenceId: source.id,
              sourceUrl: source.sourceUrl,
              collectedAt: source.createdAt,
              collector: collector.id + '@' + collector.version,
            });
          }
        }
        report.stages.push(stage);
      }
    } finally {
      clearTimeout(timer);
      controller.abort();
    }
    if (report.stages.some((s) => s.status !== 'completed')) report.status = 'partial';
    return report;
  }
}
