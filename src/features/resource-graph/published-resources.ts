import type { CaseRecord } from '../../../shared/types';
import { isTechnicalResourceLink } from '../../../shared/resource-link';
export interface PublishedResource {
  url: string;
  sourceUrl?: string;
  evidenceId?: string;
  basis: 'published' | 'shared_contact' | 'shared_business_id';
  detail?: string;
}
/** Published links are evidence of a link, never proof of common ownership. */
export function publishedResources(c: CaseRecord): PublishedResource[] {
  const result = new Map<string, PublishedResource>();
  const add = (raw: string, value: Omit<PublishedResource, 'url'>) => {
    try {
      const u = new URL(raw);
      if (!['http:', 'https:'].includes(u.protocol) || u.username || u.password) return;
      if (isTechnicalResourceLink(u)) return;
      if (
        u.hostname === new URL(c.sourceUrl!).hostname ||
        /^[\d.]+$/.test(u.hostname) ||
        u.hostname.includes(':')
      )
        return;
      u.hash = '';
      if (!result.has(u.href)) result.set(u.href, { url: u.href, ...value });
    } catch {
      /* Invalid URLs are not presented as resources. */
    }
  };
  for (const o of c.osint?.observations || [])
    if (o.kind === 'social')
      add(o.value, { sourceUrl: o.sourceUrl, evidenceId: o.evidenceId, basis: 'published' });
  for (const url of c.links) add(url, { sourceUrl: c.sourceUrl, basis: 'published' });
  for (const r of c.osint?.relations || [])
    if (
      (r.kind === 'shared_contact' || r.kind === 'shared_business_id') &&
      r.decision !== 'rejected'
    )
      add('https://' + r.to, {
        evidenceId: r.evidenceIds[0],
        basis: r.kind,
        detail: r.description,
      });
  return [...result.values()];
}
