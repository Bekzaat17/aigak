import type { Page } from 'playwright';
import type { CaseRecord, Evidence } from '../../shared/types.ts';
import type { CollectionStorage } from './contracts.ts';
import { pageTextQuality } from '../../shared/collection.ts';

/** Screenshots remain unmodified; visible text ties each viewport to its preserved source. */
export async function capturePageScreenshots(
  page: Page,
  store: Pick<CollectionStorage, 'addEvidence'>,
  record: CaseRecord,
  dom: Evidence,
  text: Evidence,
  prefix: string,
) {
  const offsets = await page.evaluate(() => {
    const points = [0];
    const terms =
      /ставк|выигрыш|депозит|бонус|казино|пополнени|вывод|casino|betting|deposit|bonus|withdraw|free bet|ұтыс|бәс тігу/iu;
    for (const el of document.querySelectorAll('h1,h2,h3,p,a,button,span,li')) {
      const rect = el.getBoundingClientRect();
      if (rect.width <= 0 || rect.height <= 0 || !terms.test((el.textContent || '').slice(0, 800)))
        continue;
      const y = Math.max(0, window.scrollY + rect.top - 220);
      if (points.every((p) => Math.abs(p - y) > window.innerHeight * 0.65)) points.push(y);
      if (points.length >= 6) break;
    }
    return points;
  });
  for (const [index, offset] of offsets.entries()) {
    await page.evaluate((y) => window.scrollTo(0, y), offset);
    await page.waitForTimeout(350);
    const visible = await page.evaluate(() => {
      const pieces: string[] = [];
      const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
      while (walker.nextNode()) {
        const node = walker.currentNode;
        if (!node.textContent?.trim() || node.parentElement?.closest('script,style,noscript'))
          continue;
        const range = document.createRange();
        range.selectNodeContents(node);
        const r = range.getBoundingClientRect();
        if (
          r.width > 0 &&
          r.height > 0 &&
          r.top >= 0 &&
          r.bottom <= innerHeight &&
          r.left >= 0 &&
          r.right <= innerWidth
        )
          pieces.push(node.textContent.trim());
      }
      return { text: pieces.join('\n').slice(0, 18000), scrollY: window.scrollY };
    });
    const bytes = await page.screenshot({ fullPage: false, type: 'png', timeout: 12000 });
    await store.addEvidence(record, bytes, {
      name: `${prefix}-screen-${index + 1}.png`,
      mime: 'image/png',
      kind: 'snapshot',
      method: 'playwright-screenshot',
      parentId: dom.id,
      sourceUrl: page.url(),
      capture: {
        textEvidenceId: text.id,
        visibleText: visible.text,
        quality: pageTextQuality(text.text || ''),
        scrollY: visible.scrollY,
      },
    });
  }
}
