import { chromium, type Browser } from 'playwright';
import type { CaseRecord } from '../../shared/types.ts';
import type { CollectionStorage } from './contracts.ts';
import { assertGroundedFinding } from '../domain/assert-grounded-finding.ts';
import { browserOptions } from './browser-options.ts';
import { installBrowserNetworkPolicy } from './install-browser-network-policy.ts';
import { waitForPageContent } from './wait-for-page-content.ts';
import { locateVisibleQuote } from './locate-visible-quote.ts';
import { StorageFailure } from '../application/errors/StorageFailure.ts';

/** Reopens cited pages and verifies the exact quote before and after an unmodified crop. */
export class BrowserFindingVerifier {
  constructor(private readonly store: Pick<CollectionStorage, 'addEvidence'>) {}
  async verify(record: CaseRecord) {
    if (record.sourceType !== 'url' || !record.findings.length) return;
    let browser: Browser;
    try {
      browser = await chromium.launch(browserOptions());
    } catch {
      for (const finding of record.findings)
        finding.visualEvidence = { status: 'unavailable', reason: 'BROWSER_UNAVAILABLE' };
      return;
    }
    const signal = AbortSignal.timeout(180000);
    const abort = () => {
      void browser.close().catch(() => {});
    };
    signal.addEventListener('abort', abort, { once: true });
    try {
      const urls = [
        ...new Set(
          record.findings
            .map((f) => record.evidence.find((e) => e.id === f.evidenceId)?.sourceUrl)
            .filter((u): u is string => !!u),
        ),
      ];
      for (const url of urls.slice(0, 4)) {
        const findings = record.findings.filter(
          (f) => record.evidence.find((e) => e.id === f.evidenceId)?.sourceUrl === url,
        );
        const context = await browser.newContext({
          viewport: { width: 1440, height: 1000 },
          locale: 'ru-RU',
          serviceWorkers: 'block',
          acceptDownloads: false,
        });
        await installBrowserNetworkPolicy(context, signal);
        const page = await context.newPage();
        try {
          await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 45000 });
          await waitForPageContent(page);
          for (const finding of findings) {
            assertGroundedFinding(finding, record.evidence);
            const bounds = await locateVisibleQuote(page, finding.quote);
            if (!bounds) {
              finding.visualEvidence = { status: 'unavailable', reason: 'QUOTE_NOT_VISIBLE' };
              continue;
            }
            const bytes = await page.screenshot({
              type: 'png',
              clip: { x: bounds.x, y: bounds.y, width: bounds.width, height: bounds.height },
              timeout: 12000,
            });
            const after = await locateVisibleQuote(page, finding.quote);
            if (
              !after ||
              Math.abs(bounds.y - after.y) > 2 ||
              Math.abs(bounds.height - after.height) > 2
            ) {
              finding.visualEvidence = { status: 'unavailable', reason: 'PAGE_CHANGED' };
              continue;
            }
            const dom = await this.store.addEvidence(record, Buffer.from(await page.content()), {
              name: `finding-${finding.id}.html`,
              mime: 'text/html',
              kind: 'snapshot',
              method: 'finding-verification-dom',
              sourceUrl: page.url(),
              parentId: finding.evidenceId,
            });
            const screenshot = await this.store.addEvidence(record, bytes, {
              name: `finding-${finding.id}.png`,
              mime: 'image/png',
              kind: 'snapshot',
              method: 'finding-screenshot',
              sourceUrl: page.url(),
              parentId: dom.id,
              capture: {
                textEvidenceId: finding.evidenceId,
                visibleText: finding.quote,
                quality: 'adequate',
                scrollY: bounds.scrollY,
              },
            });
            finding.visualEvidence = {
              status: 'verified',
              screenshotId: screenshot.id,
              verifiedAt: new Date().toISOString(),
              method: 'exact-visible-text-before-and-after-capture',
            };
          }
        } catch (error) {
          if (
            error instanceof StorageFailure ||
            (error instanceof Error && error.message === 'CASE_CONFLICT')
          )
            throw error;
          for (const finding of findings)
            if (!finding.visualEvidence)
              finding.visualEvidence = { status: 'unavailable', reason: 'PAGE_UNAVAILABLE' };
        } finally {
          await context.close().catch(() => {});
        }
      }
      for (const finding of record.findings)
        if (!finding.visualEvidence)
          finding.visualEvidence = {
            status: 'unavailable',
            reason: 'SOURCE_OR_BUDGET_UNAVAILABLE',
          };
    } finally {
      signal.removeEventListener('abort', abort);
      await browser.close();
    }
  }
}
