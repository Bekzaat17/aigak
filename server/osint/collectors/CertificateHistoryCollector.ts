import { safeFetch } from '../../network';
import { CertificateTransparencyProvider } from '../discovery/CertificateTransparencyProvider';
import type { DomainCollector, DomainTarget, CollectorResult } from '../contracts';
export class CertificateHistoryCollector implements DomainCollector {
  readonly id = 'certificate-history';
  readonly version = '1.0.0';
  constructor(private readonly provider = new CertificateTransparencyProvider(safeFetch)) {}
  async collect(target: DomainTarget, signal: AbortSignal): Promise<CollectorResult> {
    const result = await this.provider.discover(
      target.registrationDomain || target.hostname,
      signal,
    );
    return {
      status: 'completed',
      artifacts: [
        {
          name: 'certificate-history.json',
          mime: 'application/json',
          bytes: result.bytes,
          sourceUrl: result.url,
        },
      ],
      observations: result.hosts.map((value) => ({
        artifact: 0,
        kind: 'historical_certificate_name',
        value,
        status: 'observed',
      })),
      summary: {
        ru: `Журнал сертификатов: найдено имён ${result.hosts.length}. Имена могли использоваться ранее; действующий сайт и общий владелец этим не подтверждаются.`,
        kk: `Сертификаттар журналы: ${result.hosts.length} атау табылды. Атаулар бұрын қолданылған болуы мүмкін; бұл белсенді сайт пен ортақ иені растамайды.`,
      },
    };
  }
}
