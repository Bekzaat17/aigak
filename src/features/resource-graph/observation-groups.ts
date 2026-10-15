import { Building2, Contact, Globe2 } from 'lucide-react';
import type { Lang } from '../../../shared/types';
import { translator } from '../../i18n/translate.ts';
export function observationGroups(lang: Lang) {
  const t = translator(lang);
  return [
    {
      title: t('Контакты и реквизиты', 'Байланыстар мен деректемелер'),
      icon: Contact,
      description: t(
        'То, что опубликовано в материалах сайта. Принадлежность требует проверки.',
        'Сайт материалдарында жарияланған мәліметтер. Тиесілілігін тексеру қажет.',
      ),
      kinds: [
        'email',
        'phone',
        'organization',
        'address',
        'business_id',
        'license',
        'sensitive_identifier',
      ],
    },
    {
      title: t('Регистрация и организация', 'Тіркеу және ұйым'),
      icon: Building2,
      description: t(
        'Регистратор домена и совпадения с реестром — разные сведения.',
        'Домен тіркеушісі мен тізілім сәйкестіктері — бөлек мәліметтер.',
      ),
      kinds: [
        'registrar',
        'registrant_organization',
        'registration',
        'expiration',
        'last changed',
        'registry_match',
      ],
    },
    {
      title: t('Технические сведения', 'Техникалық мәліметтер'),
      icon: Globe2,
      description: t(
        'IP-адреса, DNS и сертификат. Общая инфраструктура не означает общего владельца.',
        'IP мекенжайлары, DNS және сертификат. Ортақ инфрақұрылым ортақ иені білдірмейді.',
      ),
      kinds: [
        'dns_A',
        'dns_AAAA',
        'dns_CNAME',
        'dns_NS',
        'dns_MX',
        'dns_TXT',
        'tls_names',
        'tls_issuer',
        'tls_validity',
      ],
    },
  ];
}
