import { safeFetch } from '../../network.ts';
import type { CollectorResult, DomainCollector, DomainTarget } from '../contracts.ts';
import { jsonArtifact, rdapObservations } from './observations.ts';

export class RdapCollector implements DomainCollector {
  readonly id = 'rdap';
  readonly version = '1.0.0';
  async collect(target: DomainTarget, signal: AbortSignal): Promise<CollectorResult> {
    const skip = (ru: string, kk: string): CollectorResult => ({
      status: 'skipped',
      summary: { ru, kk },
      artifacts: [],
      observations: [],
    });
    if (!target.registrationDomain)
      return skip('Регистрируемый домен не определён.', 'Тіркелетін домен анықталмады.');
    const bootstrap = await safeFetch(
      'https://data.iana.org/rdap/dns.json',
      2 * 1024 * 1024,
      3,
      signal,
    );
    if (bootstrap.status !== 200) throw new Error('RDAP_BOOTSTRAP_UNAVAILABLE');
    const services = JSON.parse(bootstrap.body.toString()).services as [string[], string[]][];
    if (!Array.isArray(services)) throw new Error('INVALID_RDAP_BOOTSTRAP');
    const tld = target.registrationDomain.split('.').at(-1)!;
    const base = services
      .find(([zones]) => Array.isArray(zones) && zones.includes(tld))?.[1]
      ?.find((u) => typeof u === 'string' && u.startsWith('https://'));
    if (!base)
      return skip(
        'В IANA нет RDAP-сервиса для этой зоны; владелец не установлен.',
        'IANA-да бұл аймақтың RDAP сервисі жоқ; иесі анықталмады.',
      );
    const url =
      base.replace(/\/$/, '') + '/domain/' + encodeURIComponent(target.registrationDomain);
    const response = await safeFetch(url, 2 * 1024 * 1024, 3, signal);
    if (response.status !== 200) throw new Error('RDAP_UNAVAILABLE');
    const data = JSON.parse(response.body.toString());
    if (
      typeof data.ldhName !== 'string' ||
      data.ldhName.toLowerCase() !== target.registrationDomain
    )
      throw new Error('RDAP_DOMAIN_MISMATCH');
    return {
      status: 'completed',
      summary: {
        ru: 'Публичный ответ RDAP сохранён. Скрытые данные не восстанавливаются; регистратор не является оператором сайта.',
        kk: 'Ашық RDAP жауабы сақталды. Жасырын деректер қалпына келтірілмейді; тіркеуші сайт операторы емес.',
      },
      artifacts: [
        {
          name: 'rdap.json',
          mime: 'application/json',
          bytes: response.body,
          sourceUrl: response.url,
        },
        jsonArtifact('rdap-source.json', {
          domain: target.registrationDomain,
          bootstrapUrl: bootstrap.url,
          bootstrapPublication: JSON.parse(bootstrap.body.toString()).publication,
          service: base,
          queriedAt: new Date().toISOString(),
        }),
      ],
      observations: rdapObservations(data),
    };
  }
}
