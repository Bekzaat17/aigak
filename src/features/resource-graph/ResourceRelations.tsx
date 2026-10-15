import type { Lang, CaseRecord } from '../../../shared/types';
import { translator } from '../../i18n/translate.ts';
import { relatedSites } from './resource-sections';
export interface ResourceRelationsProps {
  current: CaseRecord;
  lang: Lang;
  onChange?: (record: CaseRecord) => void;
}
export function ResourceRelations({ current, lang }: ResourceRelationsProps) {
  const t = translator(lang);
  const links = relatedSites(current);
  return (
    <section className="panel published-resources">
      <h3>{t('Связи с другими ресурсами', 'Басқа ресурстармен байланыстар')}</h3>
      <p>
        {t(
          'Поддомены и сайты с совпадением реквизитов или содержимого. Статус зеркала, клона или резервного сайта требует подтверждения; технические совпадения не устанавливают владельца.',
          'Қосалқы домендер және деректемелері не мазмұны сәйкес сайттар. Айна, көшірме немесе резервтік сайт мәртебесін растау қажет; техникалық сәйкестік иені анықтамайды.',
        )}
      </p>
      {!links.length && (
        <p>
          {t(
            'Связанные сайты с проверяемым основанием связи не найдены. Соцсети показаны отдельно.',
            'Тексерілетін байланыс негізі бар сайттар табылмады. Әлеуметтік желілер бөлек көрсетілген.',
          )}
        </p>
      )}
      {links.map((link) => (
        <article key={link.url}>
          <h4>
            <a href={link.url} target="_blank" rel="noreferrer">
              {new URL(link.url).hostname}
              {new URL(link.url).pathname === '/' ? '' : new URL(link.url).pathname}
            </a>
          </h4>
          <p>
            {link.basis === 'published'
              ? t(
                  'Опубликованная ссылка на поддомен того же регистрируемого домена. Назначение резервного сайта не установлено.',
                  'Сол тіркелетін доменнің қосалқы доменіне жарияланған сілтеме. Резервтік сайт қызметі анықталмады.',
                )
              : link.basis === 'shared_contact'
                ? t('Совпадает опубликованный контакт: ', 'Жарияланған байланыс сәйкес: ') +
                  link.detail
                : link.basis === 'similar_content'
                  ? t(
                      'Кандидат на копию: сходство сохранённого текста ',
                      'Көшірме үміткері: сақталған мәтін ұқсастығы ',
                    ) + link.detail
                  : t('Совпадает заявленный БИН: ', 'Көрсетілген БСН сәйкес: ') + link.detail}
          </p>
          {link.sourceUrl && (
            <a href={link.sourceUrl} target="_blank" rel="noreferrer">
              {t('Страница-источник', 'Дереккөз беті')}
            </a>
          )}
          {link.evidenceId && (
            <p>
              <a href={`/api/cases/${current.id}/evidence/${link.evidenceId}`} download>
                {t('Сохранённое основание связи', 'Байланыстың сақталған негізі')}
              </a>
            </p>
          )}
        </article>
      ))}
    </section>
  );
}
