import type { OsintReport } from '../../shared/osint';
import type { SaveArtifact } from './contracts';
import { legalCatalog } from './legal-catalog';
import type { LegalSourceReader } from './legal-source-reader';
import { parseLegalArticles } from './parse-legal-articles';
export { legalCatalog } from './legal-catalog';
export type { LegalSource } from './legal-catalog';
export { parseLegalArticles } from './parse-legal-articles';

/** Ordered, replaceable official readers; a failed format also triggers the next reader. */
export class LegalCorpusService {
  constructor(
    private readonly readers: readonly LegalSourceReader[],
    private readonly sources = legalCatalog,
  ) {}
  async enrich(report: OsintReport, save: SaveArtifact, signal = AbortSignal.timeout(28000)) {
    await Promise.all(
      this.sources.map(async (source) => {
        const started = Date.now();
        for (const reader of this.readers) {
          signal.throwIfAborted();
          try {
            const document = await reader.read(source, signal);
            const norms = parseLegalArticles(document.html, source);
            signal.throwIfAborted();
            const raw = await save(document.artifact, 'official-corpus@2');
            report.legalNorms ??= [];
            report.legalNorms = report.legalNorms.filter((n) => n.documentId !== source.id);
            report.legalNorms.push(
              ...norms.map((n) => ({
                ...n,
                evidenceId: raw.id,
                sourceUrl: document.artifact.sourceUrl!,
                retrievedAt: raw.createdAt,
                temporalStatus: 'requires_review' as const,
              })),
            );
            report.stages.push({
              id: 'law-' + source.id,
              version: '2',
              status: 'completed',
              durationMs: Date.now() - started,
              evidenceIds: [raw.id],
              summary: {
                ru: `${source.title.ru}: статьи ${source.articles.join(', ')} получены из официального источника; юридический агент проверяет применимость к находкам.`,
                kk: `${source.title.kk}: ${source.articles.join(', ')} баптары ресми дереккөзден алынды; құқықтық агент белгілерге қолданылуын тексереді.`,
              },
            });
            return;
          } catch (error) {
            signal.throwIfAborted();
            report.stages.push({
              id: `law-attempt-${source.id}-${reader.id}`,
              version: '2',
              status: 'failed',
              durationMs: Date.now() - started,
              evidenceIds: [],
              summary: {
                ru: `${source.title.ru}: ${reader.id} — ${error instanceof Error ? error.message : 'LAW_UNAVAILABLE'}`,
                kk: `${source.title.kk}: ${reader.id} — LAW_UNAVAILABLE`,
              },
            });
          }
        }
        report.stages.push({
          id: 'law-' + source.id,
          version: '2',
          status: 'failed',
          durationMs: Date.now() - started,
          evidenceIds: [],
          summary: {
            ru: `${source.title.ru}: резервные официальные источники не дали проверяемый текст.`,
            kk: `${source.title.kk}: резервтік ресми дереккөздерден тексерілетін мәтін алынбады.`,
          },
        });
      }),
    );
  }
}
