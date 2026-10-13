import type { LaunchOptions } from 'playwright';
import {
  DocxRenderer,
  PlaywrightPdfRenderer,
  StandardReportLayout,
  ZipArchiveWriter,
} from './adapters.ts';
import { EvidencePackageService } from './EvidencePackageService.ts';

export function createPackageService(browserOptions: LaunchOptions) {
  return new EvidencePackageService(
    [new StandardReportLayout()],
    new DocxRenderer(),
    new PlaywrightPdfRenderer(browserOptions),
    new ZipArchiveWriter(),
  );
}
