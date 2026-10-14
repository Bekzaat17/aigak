import type { CaseRecord } from '../../shared/types.ts';
import { CaseDocumentService } from '../application/CaseDocumentService.ts';
import { browserOptions } from '../collector.ts';
import { DocxRenderer } from '../package/adapters/DocxRenderer.ts';
import type { EvidencePackageService } from '../package/EvidencePackageService.ts';
import { createPackageService } from '../package/index.ts';
import type { AuditWriter, EvidenceStorage } from '../application/ports/storage.ts';
import type { TemplateCatalog } from '../application/ports/templates.ts';

/** One-shot document composition with an explicitly supplied template catalog. */
export function exportCase(
  store: EvidenceStorage & AuditWriter,
  templates: Pick<TemplateCatalog, 'raw'>,
  c: CaseRecord,
  includePdf = true,
  service: EvidencePackageService = createPackageService(browserOptions()),
) {
  return new CaseDocumentService(store, templates, new DocxRenderer(), service).archive(
    c,
    includePdf,
  );
}
