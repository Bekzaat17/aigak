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
    // Check each selected text node, including clipped line edges. A visible centre
    // does not prove that the entire quote survives overflow or a sticky overlay.
    for (const chunk of chunks.filter(
      (c) => c.start <= end && c.start + c.offsets.length > start,
    )) {
      const selected = document.createRange();
      selected.setStart(chunk.node, chunk.offsets[Math.max(0, start - chunk.start)]);
      selected.setEnd(
        chunk.node,
        chunk.offsets[Math.min(chunk.offsets.length - 1, end - chunk.start)] + 1,
      );
      for (const r of Array.from(selected.getClientRects())) {
        if (!r.width || !r.height) continue;
        if (r.top < 0 || r.bottom > innerHeight || r.left < 0 || r.right > innerWidth) return null;
        for (let ancestor = chunk.node.parentElement; ancestor; ancestor = ancestor.parentElement) {
          const css = getComputedStyle(ancestor);
          if (css.visibility === 'hidden' || css.display === 'none' || Number(css.opacity) === 0)
            return null;
          const box = ancestor.getBoundingClientRect();
          const left = box.left + ancestor.clientLeft;
          const top = box.top + ancestor.clientTop;
          if (
            (/(hidden|clip|auto|scroll)/.test(css.overflowX) &&
              (r.left < left - 0.5 || r.right > left + ancestor.clientWidth + 0.5)) ||
            (/(hidden|clip|auto|scroll)/.test(css.overflowY) &&
              (r.top < top - 0.5 || r.bottom > top + ancestor.clientHeight + 0.5))
          )
            return null;
        }
        for (const x of [r.left + 1, r.left + r.width / 2, r.right - 1]) {
          for (const y of [r.top + 1, r.top + r.height / 2, r.bottom - 1]) {
            const top = document.elementFromPoint(x, y);
            if (!top || !chunk.node.parentElement?.contains(top)) return null;
          }
        }
      }
    }
    return {
      x: Math.max(0, positioned.left - 32),
      y: Math.max(0, positioned.top - 48),
      width: Math.min(innerWidth - Math.max(0, positioned.left - 32), positioned.width + 64),
      height: Math.min(
        document.documentElement.scrollHeight - Math.max(0, positioned.top + scrollY - 48),
        positioned.height + 96,
      ),
      scrollY,
    };
  }, quote);
}
