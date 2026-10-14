import { osintLabels } from '../../../shared/osint';
import type { Lang } from '../../../shared/types';
import { translator } from '../../i18n/translate.ts';
export function observationLabel(kind: string, lang: Lang) {
  const t = translator(lang);
  return (
    osintLabels[kind]?.[lang] ||
    {
      dns_A: t('IP-адреса IPv4', 'IPv4 мекенжайлары'),
      dns_AAAA: t('IP-адреса IPv6', 'IPv6 мекенжайлары'),
      dns_NS: t('DNS-серверы', 'DNS серверлері'),
      dns_MX: t('Почтовые серверы', 'Пошта серверлері'),
      dns_CNAME: t('Псевдонимы домена', 'Домен бүркеншік аттары'),
      dns_TXT: t('Текстовые записи DNS', 'DNS мәтіндік жазбалары'),
    }[kind] ||
    kind
  );
}
