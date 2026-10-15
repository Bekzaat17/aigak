import type { Page, Request } from 'playwright';

/** A short-lived capability for the interstitial's final same-page verification POST. */
export class ChallengeNavigationPolicy {
  private readonly pages = new WeakMap<Page, { url: string; remaining: number }>();
  authorize(page: Page) {
    this.pages.set(page, { url: page.url(), remaining: 2 });
    return () => {
      this.pages.delete(page);
    };
  }
  allows(request: Request): boolean {
    const page = request.frame().page();
    const grant = this.pages.get(page);
    if (
      !grant ||
      grant.remaining <= 0 ||
      request.frame() !== page.mainFrame() ||
      !request.isNavigationRequest() ||
      request.method() !== 'POST'
    )
      return false;
    const target = new URL(request.url());
    const original = new URL(grant.url);
    const body = request.postData() || '';
    const keys = [...new URLSearchParams(body).keys()];
    if (
      target.origin !== original.origin ||
      target.pathname !== original.pathname ||
      target.protocol !== 'https:' ||
      body.length > 262144 ||
      !request.headers()['content-type']?.startsWith('application/x-www-form-urlencoded') ||
      keys.length < 1 ||
      keys.length > 8 ||
      !keys.every((k) => /^[a-f0-9]{64}$/i.test(k))
    )
      return false;
    grant.remaining--;
    return true;
  }
}
