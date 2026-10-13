import type { CaseRecord, Lang } from '../../shared/types.ts';
import { packageDocument } from '../export-document.ts';
import { previewImages } from '../package/appendices.ts';
import type { DocumentRenderer, PackageInput, PackageResult } from '../package/contracts.ts';
import { templateFields } from '../package/fields.ts';
import { reportHtml } from '../package/html.ts';
import type { CaseDocuments } from './ports/documents.ts';
import type { AuditWriter, EvidenceStorage } from './ports/storage.ts';
import type { TemplateCatalog } from './ports/templates.ts';

export class CaseDocumentService implements CaseDocuments {
  constructor(
    private readonly store: EvidenceStorage & AuditWriter,
    private readonly templates: Pick<TemplateCatalog, 'raw'>,
    private readonly renderer: DocumentRenderer,
    private readonly packages: { build(input: PackageInput): Promise<PackageResult> },
  ) {}

  preview(record: CaseRecord, lang: Lang): string {
    this.store.verify(record);
    const document = packageDocument(record);
    document.previewImages = previewImages(document, (id) =>
      this.store.read(
        record,
        record.evidence.find((e) => e.id === id)!,
      ),
    );
    return reportHtml(document, lang);
  }

  async document(record: CaseRecord, lang: Lang): Promise<Buffer> {
    this.store.verify(record);
    return this.renderer.render(
      await this.templates.raw(record.templateId, lang),
      templateFields(packageDocument(record), lang),
    );
  }

  async archive(record: CaseRecord, includePdf = true): Promise<Buffer> {
    this.store.verify(record);
    this.store.event(
      record,
      'package.export.requested',
      record.status === 'verified' ? 'officer-reviewed draft' : 'unreviewed draft',
    );
    const document = packageDocument(record);
    const evidenceFiles = record.evidence.map((e) => ({
      id: e.id,
      bytes: this.store.read(record, e),
    }));
    const result = await this.packages.build({
      document,
      evidenceFiles,
      templates: {
        ru: await this.templates.raw(record.templateId, 'ru'),
        kk: await this.templates.raw(record.templateId, 'kk'),
      },
      includePdf,
    });
    return result.bytes;
  }
}
