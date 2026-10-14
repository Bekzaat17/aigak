import type { Page } from 'playwright';

/** Locate exact text (whitespace-insensitive), not a keyword or inferred topic. */
export async function locateVisibleQuote(page: Page, quote: string) {
  return page.evaluate((quote) => {
    const wanted = quote.replace(/\s/gu, '').toLocaleLowerCase();
    if (!wanted) return null;
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    const chunks: { node: Node; start: number; offsets: number[] }[] = [];
    let text = '';
    while (walker.nextNode()) {
      const node = walker.currentNode,
        parent = node.parentElement;
      if (!parent || parent.closest('script,style,noscript,template,[aria-hidden="true"]'))
        continue;
      const css = getComputedStyle(parent);
      if (css.visibility === 'hidden' || css.display === 'none' || Number(css.opacity) === 0)
        continue;
      const rect = parent.getBoundingClientRect();
      if (!rect.width || !rect.height) continue;
      const raw = node.textContent || '',
        offsets: number[] = [];
      let clean = '';
      for (let i = 0; i < raw.length; i++)
        if (!/\s/u.test(raw[i])) {
          clean += raw[i];
          offsets.push(i);
        }
      if (clean) {
        chunks.push({ node, start: text.length, offsets });
        text += clean;
      }
      if (text.length > 400000) break;
    }
    const start = text.toLocaleLowerCase().indexOf(wanted);
    if (start < 0) return null;
    const end = start + wanted.length - 1;
    const first = chunks.find((c) => start >= c.start && start < c.start + c.offsets.length);
    const last = chunks.find((c) => end >= c.start && end < c.start + c.offsets.length);
    if (!first || !last) return null;
    const range = document.createRange();
    range.setStart(first.node, first.offsets[start - first.start]);
    range.setEnd(last.node, last.offsets[end - last.start] + 1);
    const rect = range.getBoundingClientRect();
    if (
      rect.width <= 0 ||
      rect.height <= 0 ||
      rect.height > innerHeight - 100 ||
      rect.width > innerWidth - 40
    )
      return null;
    first.node.parentElement?.scrollIntoView({
      block: 'center',
      inline: 'nearest',
      behavior: 'instant',
    });
    const positioned = range.getBoundingClientRect();
    // Reject obscured text (cookie dialogs, sticky overlays, loading masks).
    for (const r of Array.from(range.getClientRects())) {
      if (!r.width || !r.height) continue;
      if (r.top < 0 || r.bottom > innerHeight || r.left < 0 || r.right > innerWidth) return null;
      const top = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
      if (
        !top ||
        !chunks.some(
          (c) =>
            c.start <= end &&
            c.start + c.offsets.length > start &&
            c.node.parentElement?.contains(top),
        )
      )
        return null;
    }
    return {
      x: Math.max(0, positioned.left - 32),
      y: Math.max(0, positioned.top + scrollY - 48),
      width: Math.min(innerWidth - Math.max(0, positioned.left - 32), positioned.width + 64),
      height: Math.min(
        document.documentElement.scrollHeight - Math.max(0, positioned.top + scrollY - 48),
        positioned.height + 96,
      ),
      scrollY,
    };
  }, quote);
}
