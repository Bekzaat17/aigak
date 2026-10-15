import type { Request } from 'playwright';
export interface PublicPagePostRule {
  origin: string;
  path: string;
  contentType: string;
  maxBytes: number;
  maxRequests: number;
}
/** Explicitly registered public-page telemetry; excludes every unregistered POST endpoint. */
export class PublicPagePostPolicy {
  private readonly counts = new Map<PublicPagePostRule, number>();
  constructor(private readonly rules: readonly PublicPagePostRule[]) {}
  allows(request: Request): boolean {
    if (request.method() !== 'POST' || request.isNavigationRequest()) return false;
    const url = new URL(request.url());
    const page = new URL(request.frame().page().url());
    const rule = this.rules.find(
      (r) =>
        url.origin === r.origin &&
        page.origin === r.origin &&
        url.pathname === r.path &&
        request.headers()['content-type']?.split(';')[0] === r.contentType &&
        (request.postDataBuffer()?.length || 0) <= r.maxBytes,
    );
    if (!rule || (this.counts.get(rule) || 0) >= rule.maxRequests) return false;
    this.counts.set(rule, (this.counts.get(rule) || 0) + 1);
    return true;
  }
}
