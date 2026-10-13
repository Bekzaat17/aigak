import { EvidencePackageService } from './service.ts';
import { DocxRenderer, PlaywrightPdfRenderer, StandardReportLayout, ZipArchiveWriter } from './adapters.ts';
import type { LaunchOptions } from 'playwright';

export function createPackageService(browserOptions:LaunchOptions) {
  return new EvidencePackageService([new StandardReportLayout()],new DocxRenderer(),new PlaywrightPdfRenderer(browserOptions),new ZipArchiveWriter());
}
