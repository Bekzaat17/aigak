import { getDomain } from 'tldts';
import type { CaseRecord } from '../../../shared/types';
import { publishedResources } from './published-resources';
export function isSocialProfile(raw: string) {
  try {
    const u = new URL(raw);
    const host = u.hostname.replace(/^www\./, '');
    return (
      [
        't.me',
        'telegram.me',
        'instagram.com',
        'facebook.com',
        'vk.com',
        'youtube.com',
        'youtu.be',
        'tiktok.com',
        'x.com',
        'twitter.com',
        'linkedin.com',
        'wa.me',
      ].includes(host) &&
      u.pathname !== '/' &&
      !/^\/(share|sharer|intent|login|signup)(\/|\.|$)/i.test(u.pathname)
    );
  } catch {
    return false;
  }
}
export function socialProfiles(c: CaseRecord) {
  return publishedResources(c).filter((r) => isSocialProfile(r.url));
}
export function relatedSites(c: CaseRecord) {
  const domain = c.sourceUrl ? getDomain(c.sourceUrl) : null;
  return publishedResources(c).filter(
    (r) =>
      !isSocialProfile(r.url) &&
      (r.basis !== 'published' || (domain && getDomain(r.url) === domain)),
  );
}
