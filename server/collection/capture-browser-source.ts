import { capturePageEvidence } from './capture-page-evidence';
import type { BrowserSessionFactory } from './browser/contracts';
import { openInterceptedSession } from './browser/open-intercepted-session';
import type { CaseRecord } from '../../shared/types.ts';
import type { CollectionStorage, EvidenceExtractor } from './contracts.ts';
import { waitForPageContent } from './wait-for-page-content.ts';

export async function captureBrowserSource(
  store: Pick<CollectionStorage, 'addEvidence'>,
  c: CaseRecord,
  extraction: EvidenceExtractor,
  viewport: { width: number; height: number },
  prefix: string,
  signal: AbortSignal,
  openSession: BrowserSessionFactory = openInterceptedSession,
) {
  const session = await openSession(signal, viewport);
  try {
    signal.throwIfAborted();
    const context = session.context;
    const page = await context.newPage();
    page.setDefaultTimeout(12000);
    await page.goto(c.sourceUrl!, { waitUntil: 'domcontentloaded', timeout: 45000 });
    try {
      await session.preparePage?.(page, (action) => c.scenarioRun?.actions.push(action));
    } catch (error) {
      signal.throwIfAborted();
      await capturePageEvidence(page, store, c, extraction, viewport, prefix);
      throw error;
    }
    await waitForPageContent(page);
    signal.throwIfAborted();
    await capturePageEvidence(page, store, c, extraction, viewport, prefix);
  } finally {
    await session.close();
  }
}
