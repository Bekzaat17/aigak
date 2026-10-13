import { domainToUnicode } from 'node:url';
import { parse } from 'tldts';
import { parsePublicUrl } from '../network.ts';
import type { DomainTarget } from './contracts.ts';
export function domainTarget(value: string): DomainTarget {
  const u = parsePublicUrl(value);
  const hostname = u.hostname
    .replace(/^\[|\]$/g, '')
    .replace(/\.$/, '')
    .toLowerCase();
  const icann = parse(hostname),
    site = parse(hostname, { allowPrivateDomains: true });
  return {
    url: u.href,
    hostname,
    unicodeHostname: domainToUnicode(hostname) || hostname,
    registrationDomain: icann.domain || undefined,
    siteDomain: site.domain || undefined,
  };
}
