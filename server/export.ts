import type { CaseRecord } from '../shared/types.ts';
import { CaseDocumentService } from './application/CaseDocumentService.ts';
import { browserOptions } from './collector.ts';
import { DocxRenderer } from './package/adapters/DocxRenderer.ts';
import type { EvidencePackageService } from './package/EvidencePackageService.ts';
import { createPackageService } from './package/index.ts';
import type { Store } from './storage/Store.ts';
import { Templates } from './templates.ts';
export { packageDocument, reportHtml } from './export-document.ts';

/** Compatibility entry point for existing callers; runtime wiring lives in bootstrap. */
export function exportCase(
  store: Store,
  c: CaseRecord,
  includePdf = true,
  service: EvidencePackageService = createPackageService(browserOptions()),
) {
  return new CaseDocumentService(store, new Templates(store), new DocxRenderer(), service).archive(
    c,
    includePdf,
  );
}
