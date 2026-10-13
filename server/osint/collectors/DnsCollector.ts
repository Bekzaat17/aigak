import { Resolver } from 'node:dns/promises';
import type { CollectorResult, DomainCollector, DomainTarget } from '../contracts.ts';
import { jsonArtifact } from './observations.ts';

export class DnsCollector implements DomainCollector {
  readonly id = 'dns';
  readonly version = '1.0.0';
  async collect(target: DomainTarget, signal: AbortSignal): Promise<CollectorResult> {
    const resolver = new Resolver({ timeout: 2500, tries: 1 });
    const cancel = () => resolver.cancel();
    signal.addEventListener('abort', cancel, { once: true });
    const types = ['A', 'AAAA', 'CNAME', 'NS', 'MX', 'TXT'] as const;
    try {
      signal.throwIfAborted();
      const records = await Promise.all(
        types.map(async (type) => {
          try {
            return {
              type,
              status: 'observed',
              values: await resolver.resolve(target.hostname, type),
            };
          } catch (error) {
            const code = (error as NodeJS.ErrnoException).code;
            return {
              type,
              status: ['ENODATA', 'ENOTFOUND'].includes(code || '') ? 'not_found' : 'unavailable',
              values: [],
            };
          }
        }),
      );
      const partial = records.some((r) => r.status === 'unavailable');
      return {
        status: partial ? 'partial' : 'completed',
        summary: {
          ru: 'DNS — техническая инфраструктура на момент запроса; общий IP/NS не доказывает общего владельца.',
          kk: 'DNS — сұрау сәтіндегі техникалық инфрақұрылым; ортақ IP/NS ортақ иені дәлелдемейді.',
        },
        artifacts: [
          jsonArtifact('dns.json', {
            hostname: target.hostname,
            queriedAt: new Date().toISOString(),
            records,
          }),
        ],
        observations: records
          .filter((r) => Array.isArray(r.values) && r.values.length)
          .map((r) => ({
            artifact: 0,
            kind: 'dns_' + r.type,
            value: JSON.stringify(r.values),
            status: 'observed',
          })),
      };
    } finally {
      signal.removeEventListener('abort', cancel);
    }
  }
}
