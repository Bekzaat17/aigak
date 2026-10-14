import { accessSignals } from './access-signals';
import type { CaseRecord, Lang } from '../../../shared/types';
export function AccessObservations({ c, lang }: { c: CaseRecord; lang: Lang }) {
  const t = (ru: string, kk: string) => (lang === 'ru' ? ru : kk);
  const attempts = c.collection?.attempts || [];
  const limited = attempts.filter((a) => a.status !== 'adequate');
  const recovered = attempts.some((a) => a.status === 'adequate');
  const { challenges, changedAddress } = accessSignals(c);
  if (!limited.length && !challenges.length && !changedAddress) return null;
  return (
    <section className="panel access-observations">
      <h3>{t('Особенности доступа к сайту', 'Сайтқа кіру ерекшеліктері')}</h3>
      {limited.length > 0 && (
        <p>
          {recovered
            ? t(
                'Не все способы загрузки показали содержимое. Материалы получены другим способом.',
                'Барлық жүктеу тәсілдері мазмұнды көрсетпеді. Материалдар басқа тәсілмен алынды.',
              )
            : t(
                'Получить полное содержимое не удалось. Выводы ограничены сохранёнными материалами.',
                'Толық мазмұн алынбады. Қорытындылар сақталған материалдармен шектелген.',
              )}
        </p>
      )}
      {challenges.map((e) => (
        <p key={e.id}>
          {t(
            'Сайт вернул проверку посетителя или сообщение об ограничении доступа: ',
            'Сайт келушіні тексеруді немесе кіру шектеуі туралы хабарды қайтарды: ',
          )}
          <q>{e.text?.trim().slice(0, 180)}</q>
          {' · '}
          <a href={`/api/cases/${c.id}/evidence/${e.id}`} download>
            {t('Сохранённое сообщение', 'Сақталған хабар')}
          </a>
        </p>
      ))}
      {changedAddress && (
        <p>
          {t(
            'Адрес после загрузки отличается от запрошенного: ',
            'Жүктегеннен кейінгі мекенжай сұралғаннан өзгеше: ',
          )}
          <a href={changedAddress.requested}>{changedAddress.requested}</a>
          {' → '}
          <a href={changedAddress.final}>{changedAddress.final}</a>
        </p>
      )}
      {attempts.map((a, i) => (
        <p key={i}>
          {a.method === 'http'
            ? t('Обычная загрузка', 'Қарапайым жүктеу')
            : a.method === 'browser-mobile'
              ? t('Мобильный браузер', 'Мобильді браузер')
              : t('Браузер', 'Браузер')}
          : {a.textLength ?? 0} {t('символов текста', 'мәтін таңбасы')}.{' '}
          {a.evidenceIds[0] && (
            <a href={`/api/cases/${c.id}/evidence/${a.evidenceIds[0]}`} download>
              {t('Сохранённый ответ сайта', 'Сайттың сақталған жауабы')}
            </a>
          )}
        </p>
      ))}
      <p>
        {t(
          'Намеренное сокрытие или обход проверки не установлены: различие ответов само по себе этого не доказывает.',
          'Әдейі жасыру немесе тексеруді айналып өту анықталмады: жауаптар айырмашылығы мұны өздігінен дәлелдемейді.',
        )}
      </p>
    </section>
  );
}
