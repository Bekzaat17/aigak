import type { Lang, CaseRecord } from '../../../shared/types';
import { translator } from '../../i18n/translate.ts';
import { publishedResources } from './published-resources';
export interface ResourceRelationsProps {
  current: CaseRecord;
  lang: Lang;
  onChange?: (record: CaseRecord) => void;
}
export function ResourceRelations({ current, lang }: ResourceRelationsProps) {
  const t = translator(lang);
  const links = publishedResources(current);
  return (
    <section className="panel published-resources">
      <h3>{t('Связи с другими ресурсами', 'Басқа ресурстармен байланыстар')}</h3>
      <p>
        {t(
          'Опубликованные ссылки и совпадения реквизитов. Общий владелец не установлен; IP-адреса вынесены в детали анализа.',
          'Жарияланған сілтемелер мен деректемелер сәйкестіктері. Ортақ ие анықталмаған; IP мекенжайлары талдау мәліметтеріне шығарылды.',
        )}
      </p>
      {!links.length && (
        <p>
          {t(
            'В сохранённых материалах ссылки на другие ресурсы и социальные сети не найдены.',
            'Сақталған материалдардан басқа ресурстар мен әлеуметтік желілерге сілтемелер табылмады.',
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
                  'Ссылка найдена в сохранённых материалах сайта.',
                  'Сілтеме сайттың сақталған материалдарынан табылды.',
                )
              : link.basis === 'shared_contact'
                ? t('Совпадает опубликованный контакт: ', 'Жарияланған байланыс сәйкес: ') +
                  link.detail
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
