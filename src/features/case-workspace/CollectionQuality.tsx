import type { CaseRecord, Lang } from '../../../shared/types';
import { formatDuration } from '../../lib/format-duration';

export function CollectionQuality({ c, lang }: { c: CaseRecord; lang: Lang }) {
  const report = c.collection;
  if (!report) return null;
  const t = (ru: string, kk: string) => (lang === 'ru' ? ru : kk);
  return (
    <details className="panel collection-quality" open={report.status !== 'adequate'}>
      <summary>
        {report.status === 'adequate'
          ? t(
              'Содержимое получено · способы сбора и источники',
              'Мазмұн алынды · жинау тәсілдері мен дереккөздер',
            )
          : t(
              'Содержимое получено не полностью · ограничения сбора',
              'Мазмұн толық алынбады · жинау шектеулері',
            )}
      </summary>
      <p>
        {t(
          'Проверка относится к сохранённым страницам. Достаточный объём текста не означает проверку всех разделов сайта.',
          'Тексеру сақталған беттерге қатысты. Мәтіннің жеткілікті көлемі сайттың барлық бөлімдері тексерілгенін білдірмейді.',
        )}
      </p>
      {report.attempts.map((attempt, i) => (
        <div key={i}>
          <strong>
            {(
              {
                http: 'HTTP',
                'browser-desktop': t('Браузер · компьютер', 'Браузер · компьютер'),
                'browser-mobile': t('Браузер · мобильный экран', 'Браузер · мобильді экран'),
              } as Record<string, string>
            )[attempt.method] || attempt.method}
          </strong>
          {' · '}
          {formatDuration(attempt.durationMs, lang)}
          {' · '}
          {attempt.textLength} {t('символов', 'таңба')}
          {' · '}
          {attempt.status === 'adequate'
            ? t('текст получен', 'мәтін алынды')
            : attempt.status === 'failed'
              ? t('ошибка', 'қате')
              : t('мало текста / заставка', 'аз мәтін / жүктеу экраны')}
          {attempt.errorCode && <small> · {attempt.errorCode}</small>}
          <p>
            {attempt.evidenceIds.map((id) => {
              const e = c.evidence.find((item) => item.id === id);
              return e ? (
                <a
                  key={id}
                  href={`/api/cases/${c.id}/evidence/${id}`}
                  target="_blank"
                  rel="noreferrer"
                >
                  {e.name}
                  {' · '}
                </a>
              ) : null;
            })}
          </p>
        </div>
      ))}
    </details>
  );
}
