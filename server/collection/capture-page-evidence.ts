import type { Page } from 'playwright';
import type { CaseRecord } from '../../shared/types.ts';
import type { CollectionStorage, EvidenceExtractor } from './contracts.ts';
import { saveText } from './text-evidence.ts';
import { capturePageScreenshots } from './capture-page-screenshots.ts';
import { pageTextQuality } from '../../shared/collection.ts';

export async function capturePageEvidence(
  page: Page,
  store: Pick<CollectionStorage, 'addEvidence'>,
  c: CaseRecord,
  extraction: EvidenceExtractor,
  viewport: { width: number; height: number },
  prefix: string,
) {
  const text = await page.locator('body').innerText();
  const original = [...c.evidence]
    .reverse()
    .find((e) => e.method === 'http-get' && e.mime === 'text/html');
  const dom = await store.addEvidence(c, Buffer.from(await page.content()), {
    name: `${prefix}-rendered.html`,
    mime: 'text/html',
    kind: 'snapshot',
    method: 'playwright-dom',
    parentId: original?.id,
    sourceUrl: page.url(),
  });
  const links = await page
    .locator('a[href]')
    .evaluateAll((nodes) => nodes.map((n) => (n as HTMLAnchorElement).href));
  c.links = [...new Set([...c.links, ...links.filter((url) => /^https?:\/\//.test(url))])].slice(
    0,
    100,
  );
  await saveText(store, c, dom, text, 'playwright-innerText');
  const textEvidence = c.evidence.find((e) => e.parentId === dom.id && e.kind === 'text');
  if (textEvidence) await capturePageScreenshots(page, store, c, dom, textEvidence, prefix);
  // OCR is a distinct fallback for image/canvas content, never a substitute for readable DOM.
  if (pageTextQuality(text) === 'limited') {
    for (const image of c.evidence.filter((e) => e.parentId === dom.id && e.mime === 'image/png'))
      await extraction.extract(c, image);
  }
  await store.addEvidence(
    c,
    Buffer.from(
      JSON.stringify(
        {
          url: page.url(),
          capturedAt: new Date().toISOString(),
          viewport,
          transport: prefix,
          locale: 'ru-RU',
          quality: pageTextQuality(text),
          networkPolicy: 'Public GET only; pinned DNS; bounded requests and bytes',
        },
        null,
        2,
      ),
    ),
    {
      name: `${prefix}-metadata.json`,
      mime: 'application/json',
      kind: 'metadata',
      method: 'playwright',
      parentId: dom.id,
      sourceUrl: page.url(),
    },
  );
}
