import type { CaseRecord } from '../../shared/types';
import type { CollectionStorage, EvidenceExtractor, UrlCollectionMethod } from './contracts';
import type { BrowserSessionFactory } from './browser/contracts';
import { capturePageEvidence } from './capture-page-evidence';
import { findPublicLinks } from '../ai/prompts/browser-agent';
import { parsePublicUrl } from '../network';

/** Bounded autonomous navigation: only verified public information links, never arbitrary clicks. */
export class AgentBrowserCollectionMethod implements UrlCollectionMethod {
  readonly id = 'browser-agent';
  constructor(
    private readonly store: Pick<CollectionStorage, 'addEvidence'>,
    private readonly extraction: EvidenceExtractor,
    private readonly open: BrowserSessionFactory,
  ) {}
  async collect(c: CaseRecord, signal: AbortSignal) {
    const viewport = { width: 1440, height: 1000 };
    const session = await this.open(signal, viewport);
    try {
      const page = await session.context.newPage();
      await page.goto(c.sourceUrl!, { waitUntil: 'domcontentloaded', timeout: 25000 });
      await session.preparePage?.(page, (action) => c.scenarioRun?.actions.push(action));
      await page.waitForTimeout(1500);
      await capturePageEvidence(page, this.store, c, this.extraction, viewport, this.id);
      if (!session.observe) return;
      const origin = parsePublicUrl(c.sourceUrl!).origin;
      const actions = await session.observe(page, findPublicLinks, (a) =>
        c.scenarioRun?.actions.push(a),
      );
      const urls = new Set<string>();
      for (const action of actions) {
        const node = page.locator(action.selector);
        if ((await node.count()) !== 1 || !(await node.isVisible())) continue;
        const href = await node.evaluate((e) => (e instanceof HTMLAnchorElement ? e.href : null));
        if (!href) continue;
        const url = parsePublicUrl(href);
        if (
          url.origin !== origin ||
          /login|sign.?in|register|logout|deposit|withdraw|payment|play|\/bet\b/i.test(url.pathname)
        )
          continue;
        if (
          !/terms|rules|licen[cs]e|about|contact|responsible|casino|sports|правил|лиценз/i.test(
            url.pathname,
          )
        )
          continue;
        urls.add(url.href);
      }
      for (const url of [...urls].slice(0, 3)) {
        signal.throwIfAborted();
        await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 15000 });
        if (parsePublicUrl(page.url()).origin !== origin) continue;
        await session.preparePage?.(page, (action) => c.scenarioRun?.actions.push(action));
        await capturePageEvidence(page, this.store, c, this.extraction, viewport, this.id);
      }
    } finally {
      await session.close();
    }
  }
}
