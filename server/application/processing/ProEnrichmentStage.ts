import type { OsintReport } from '../../../shared/osint.ts';
import type { CaseRecord, Evidence } from '../../../shared/types.ts';
import type { SaveArtifact } from '../../osint/contracts.ts';
import type { ProcessingStage } from '../ports/processing.ts';
import type { CaseStore } from '../ports/storage.ts';

export class ProEnrichmentStage implements ProcessingStage {
  constructor(
    private readonly store: Pick<CaseStore, 'addEvidence' | 'event' | 'read'>,
    private readonly official: { enrich(report: OsintReport, save: SaveArtifact): Promise<void> },
    private readonly legal: { enrich(report: OsintReport, save: SaveArtifact): Promise<void> },
    private readonly detective: {
      investigate(report: OsintReport, evidence: Evidence[], save: SaveArtifact): Promise<void>;
    },
    private readonly resources: {
      investigate(report: OsintReport, evidence: Evidence[], save: SaveArtifact): Promise<void>;
    },
  ) {}
  async execute(c: CaseRecord): Promise<void> {
    if (!c.osint) throw new Error('OSINT_REQUIRED');
    if (c.analysisLevel === 'pro') {
      c.step = {
        ru: 'Сверяем реестр и сохраняем нормы закона',
        kk: 'Тізілімді салыстырып, заң нормаларын сақтаймыз',
      };
      await this.store.event(c, 'official.started');
      await this.official.enrich(
        c.osint,
        async (a, collector) =>
          await this.store.addEvidence(c, a.bytes, {
            name: a.name,
            mime: a.mime,
            kind: 'metadata',
            method: collector,
            sourceUrl: a.sourceUrl,
          }),
      );
      await this.legal.enrich(
        c.osint,
        async (a, collector) =>
          await this.store.addEvidence(c, a.bytes, {
            name: a.name,
            mime: a.mime,
            kind: 'metadata',
            method: collector,
            sourceUrl: a.sourceUrl,
          }),
      );
      c.step = { ru: 'Проверка технических связей', kk: 'Техникалық байланыстарды тексеру' };
      await this.store.event(c, 'detective.started');
      const sources = c.evidence.map((e) =>
        e.mime === 'text/html' && !e.method.startsWith('official-')
          ? { ...e, text: this.store.read(c, e).toString() }
          : e,
      );
      await this.detective.investigate(
        c.osint,
        sources,
        async (a, collector) =>
          await this.store.addEvidence(c, a.bytes, {
            name: a.name,
            mime: a.mime,
            kind: 'metadata',
            method: collector,
            sourceUrl: a.sourceUrl,
          }),
      );
      await this.resources.investigate(
        c.osint,
        sources,
        async (a, collector) =>
          await this.store.addEvidence(c, a.bytes, {
            name: a.name,
            mime: a.mime,
            kind: a.text ? 'text' : 'metadata',
            text: a.text,
            method: collector,
            sourceUrl: a.sourceUrl,
          }),
      );
    }
    await this.store.event(c, 'osint.completed', c.osint.status);
  }
}
