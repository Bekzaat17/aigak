import { chromium, type LaunchOptions } from 'playwright';
import type { PackageFile, PdfRenderer } from '../contracts.ts';

export class PlaywrightPdfRenderer implements PdfRenderer {
  constructor(private readonly options: LaunchOptions) {}
  async render(reports: Parameters<PdfRenderer['render']>[0]): Promise<PackageFile[]> {
    const browser = await chromium.launch(this.options);
    try {
      const page = await browser.newPage({ javaScriptEnabled: false });
      await page.route('**/*', (r) => r.abort());
      const files: PackageFile[] = [];
      for (const report of reports) {
        await page.setContent(report.html);
        files.push({
          path: `report-${report.lang}.pdf`,
          bytes: await page.pdf({ format: 'A4', printBackground: true }),
        });
      }
      return files;
    } finally {
      await browser.close();
    }
  }
}
