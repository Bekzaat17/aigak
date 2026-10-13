import type { ResourceRelation } from '../../../shared/osint';
import type { Lang } from '../../../shared/types';

export const relationName = (kind: ResourceRelation['kind'], lang: Lang) =>
  ({
    links_to: ['Ссылка на ресурс', 'Ресурсқа сілтеме'],
    resolves_to: ['IP-адрес', 'IP мекенжайы'],
    certificate_contains: ['Общий сертификат', 'Ортақ сертификат'],
    ct_contains: ['История сертификатов', 'Сертификаттар тарихы'],
    shared_contact: ['Совпадает email', 'Email сәйкес'],
    shared_business_id: ['Совпадает заявленный БИН', 'Көрсетілген БСН сәйкес'],
    similar_content: ['Похожий текст', 'Ұқсас мәтін'],
  })[kind][lang === 'ru' ? 0 : 1];
