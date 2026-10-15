import { load } from 'cheerio';
import { safeFetch } from '../../network';
import type {
  DomainCollector,
  DomainTarget,
  CollectorResult,
  ObservationDraft,
} from '../contracts';

export function kaznicObservations(text: string, domain: string): ObservationDraft[] {
  const field = (label: string) =>
    text.match(new RegExp('^' + label + '\\.*\\s*:\\s*(.*)$', 'mi'))?.[1].trim();
  if (field('Domain Name')?.toLowerCase() !== domain) throw Error('WHOIS_DOMAIN_MISMATCH');
  const observations: ObservationDraft[] = [];
  const organization = text
    .split(/Administrative Contact/i)[0]
    .match(/^Organization Name\.*\s*:\s*(.*)$/im)?.[1]
    .trim();
  if (organization && !/redacted|privacy|not disclosed/i.test(organization))
    observations.push({
      artifact: 0,
      kind: 'registrant_organization',
      value: organization,
      status: 'observed',
    });
  else
    observations.push({
      artifact: 0,
      kind: 'registrant_privacy',
      value: 'KazNIC: registrant organization not publicly disclosed',
      status: 'masked',
    });
  for (const [label, kind] of [
    ['Domain created', 'registration'],
    ['Last modified', 'last changed'],
    ['Expiration date', 'expiration'],
    ['Current Registrar', 'registrar'],
  ] as const) {
    const value = field(label);
    if (value)
      observations.push({
        artifact: 0,
        kind,
        value: kind === 'registrar' ? value : value.replace(' (GMT+0:00)', 'Z').replace(' ', 'T'),
        status: 'observed',
      });
  }
  return observations;
}
export class KaznicWhoisCollector implements DomainCollector {
  readonly id = 'kaznic-whois';
  readonly version = '1.0.0';
  constructor(private readonly fetcher = safeFetch) {}
  async collect(target: DomainTarget, signal: AbortSignal): Promise<CollectorResult> {
    const domain = target.registrationDomain;
    if (!domain || !/\.(kz|xn--80ao21a)$/.test(domain))
      return {
        status: 'skipped',
        summary: {
          ru: 'KazNIC применяется только к доменам .kz и .қаз.',
          kk: 'KazNIC тек .kz және .қаз домендеріне қолданылады.',
        },
        artifacts: [],
        observations: [],
      };
    const response = await this.fetcher(
      'https://www.nic.kz/en/whois?query=' + encodeURIComponent(domain),
      1024 * 1024,
      2,
      signal,
    );
    if (response.status !== 200) throw Error('WHOIS_UNAVAILABLE');
    const text = load(response.body.toString())('pre').text();
    const observations = kaznicObservations(text, domain);
    return {
      status: 'completed',
      summary: {
        ru: 'Официальный WHOIS KazNIC: регистрация, изменения и регистратор. Организация-регистрант не тождественна оператору сайта; скрытые сведения не восстанавливаются.',
        kk: 'Ресми KazNIC WHOIS: тіркелу, өзгерістер және тіркеуші. Тіркелуші ұйым сайт операторымен бірдей емес; жасырылған мәліметтер қалпына келтірілмейді.',
      },
      artifacts: [
        {
          name: 'kaznic-whois.html',
          mime: 'text/html',
          bytes: response.body,
          sourceUrl: response.url,
        },
      ],
      observations,
    };
  }
}
