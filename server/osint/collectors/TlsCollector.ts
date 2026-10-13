import { isIP } from 'node:net';
import { connect } from 'node:tls';
import { resolvePublic } from '../../network.ts';
import type { CollectorResult, DomainCollector, DomainTarget } from '../contracts.ts';
import { jsonArtifact } from './observations.ts';

export class TlsCollector implements DomainCollector {
  readonly id = 'tls';
  readonly version = '1.0.0';
  async collect(target: DomainTarget, signal: AbortSignal): Promise<CollectorResult> {
    if (new URL(target.url).protocol !== 'https:')
      return {
        status: 'skipped',
        summary: {
          ru: 'Исходный адрес использует HTTP; TLS не запрашивался.',
          kk: 'Бастапқы мекенжай HTTP қолданады; TLS сұралмады.',
        },
        artifacts: [],
        observations: [],
      };
    const address = await resolvePublic(new URL(target.url));
    signal.throwIfAborted();
    const certificate = await new Promise<Record<string, unknown>>((resolve, reject) => {
      const socket = connect({
        host: address.address,
        port: 443,
        servername: isIP(target.hostname) ? undefined : target.hostname,
        rejectUnauthorized: true,
      });
      const abort = () => socket.destroy(new Error('OSINT_CANCELLED'));
      signal.addEventListener('abort', abort, { once: true });
      const timer = setTimeout(() => socket.destroy(new Error('TLS_TIMEOUT')), 7000);
      socket.once('secureConnect', () => {
        const cert = socket.getPeerCertificate();
        resolve({
          hostname: target.hostname,
          connectedAddress: address.address,
          subjectAltName: cert.subjectaltname,
          issuer: cert.issuer,
          validFrom: cert.valid_from,
          validTo: cert.valid_to,
          fingerprint256: cert.fingerprint256,
          certificatePem: cert.raw
            ? '-----BEGIN CERTIFICATE-----\n' +
              cert.raw
                .toString('base64')
                .match(/.{1,64}/g)!
                .join('\n') +
              '\n-----END CERTIFICATE-----'
            : undefined,
        });
        socket.destroy();
      });
      socket.once('error', reject);
      socket.once('close', () => {
        clearTimeout(timer);
        signal.removeEventListener('abort', abort);
      });
      if (signal.aborted) abort();
    });
    return {
      status: 'completed',
      summary: {
        ru: 'Проверенный TLS-сертификат сервера сохранён. Имена сертификата не устанавливают владельца.',
        kk: 'Сервердің тексерілген TLS сертификаты сақталды. Сертификат атаулары иені анықтамайды.',
      },
      artifacts: [jsonArtifact('tls.json', certificate, target.url)],
      observations: [
        {
          artifact: 0,
          kind: 'tls_names',
          value: String(certificate.subjectAltName || ''),
          status: 'observed',
        },
        {
          artifact: 0,
          kind: 'tls_issuer',
          value: JSON.stringify(certificate.issuer),
          status: 'observed',
        },
        {
          artifact: 0,
          kind: 'tls_validity',
          value: String(certificate.validFrom) + ' — ' + String(certificate.validTo),
          status: 'observed',
        },
      ],
    };
  }
}
