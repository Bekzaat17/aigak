import { safeFetch } from '../../network.ts';
import { domainTarget } from '../domain.ts';
import type { DiscoveryProvider } from './contracts.ts';

export class CertificateTransparencyProvider implements DiscoveryProvider {
  id = 'certificate-transparency';
  constructor(private fetcher: typeof safeFetch = safeFetch) {}
  async discover(domain: string, signal: AbortSignal) {
    const url = 'https://crt.sh/?q=' + encodeURIComponent('%.' + domain) + '&output=json';
    const response = await this.fetcher(url, 2 * 1024 * 1024, 2, signal);
    if (response.status !== 200) throw Error('CT_UNAVAILABLE');
    const rows: unknown = JSON.parse(response.body.toString());
    if (!Array.isArray(rows)) throw Error('CT_FORMAT');
    const hosts = new Set<string>();
    for (const row of rows.slice(0, 5000))
      for (const name of String(row.name_value || '').split('\n')) {
        try {
          if (name.includes('*')) continue;
          const host = domainTarget('https://' + name).hostname;
          if (host === domain || host.endsWith('.' + domain)) hosts.add(host);
        } catch {
          // Malformed or non-public candidate URLs are excluded.
        }
      }
    return { hosts: [...hosts].sort().slice(0, 30), bytes: response.body, url: response.url };
  }
}
