import type { Page } from 'playwright';
/** Keep rendered evidence, discard executable code and hidden credential/token fields. */
export async function sanitizedDom(page: Page) {
  return page.evaluate(() => {
    const root = document.documentElement.cloneNode(true) as HTMLElement;
    root.querySelectorAll('script,input,textarea,meta,link,iframe').forEach((e) => e.remove());
    root.querySelectorAll('*').forEach((e) => {
      for (const a of [...e.attributes])
        if (!['class', 'id', 'style', 'role', 'aria-label'].includes(a.name))
          e.removeAttribute(a.name);
    });
    return '<!doctype html>' + root.outerHTML;
  });
}
