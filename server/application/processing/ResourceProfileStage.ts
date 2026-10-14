import type { OsintReport, OsintStage } from '../../../shared/osint.ts';
import type { CaseRecord } from '../../../shared/types.ts';
import type { OsintInput, SaveArtifact } from '../../osint/contracts.ts';
import type { ProcessingStage } from '../ports/processing.ts';
import type { CaseStore } from '../ports/storage.ts';

export class ResourceProfileStage implements ProcessingStage {
  readonly id = 'resource-profile-v1';
  constructor(
    private readonly store: Pick<CaseStore, 'addEvidence' | 'event'>,
    private readonly collectContactPages: (c: CaseRecord) => Promise<OsintStage>,
    private readonly osint: {
      inspect(input: OsintInput, save: SaveArtifact): Promise<OsintReport>;
    },
  ) {}
  async execute(c: CaseRecord): Promise<void> {
    c.step = {
      ru: 'Паспорт ресурса и публичные реквизиты',
      kk: 'Ресурс паспорты және ашық деректемелер',
    };
    await this.store.event(c, 'osint.started');
    const pageStage = c.reanalysis ? undefined : await this.collectContactPages(c);
    c.osint = await this.osint.inspect(
      {
        url: c.sourceUrl,
        finalUrl:
          c.evidence.find((e) => e.method === 'playwright-dom')?.sourceUrl ||
          c.redirects.at(-1)?.url,
        evidence: [...c.evidence],
      },
      async (artifact, collector) =>
        await this.store.addEvidence(c, artifact.bytes, {
          name: artifact.name,
          mime: artifact.mime,
          kind: 'metadata',
          method: 'osint-' + collector,
          sourceUrl: artifact.sourceUrl,
        }),
    );
    if (pageStage) c.osint.stages.unshift(pageStage);
    if (pageStage?.status === 'partial') c.osint.status = 'partial';
  }
}
