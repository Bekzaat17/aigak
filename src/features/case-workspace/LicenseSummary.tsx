import type { CaseRecord, Lang } from '../../../shared/types';

export function LicenseSummary({ c, lang }: { c: CaseRecord; lang: Lang }) {
  const t = (ru: string, kk: string) => (lang === 'ru' ? ru : kk);
  const registry = c.osint?.registry;
  const source = c.evidence.find((e) => e.id === registry?.evidenceId);
  const claims = c.osint?.observations.filter((o) => o.kind === 'license') || [];
  const documents = c.links.filter((link) => {
    try {
      const u = new URL(link);
      return (
        /^https?:$/.test(u.protocol) &&
        /(?:license|licence|licen[sz]|лиценз)/iu.test(u.pathname) &&
        /\.pdf$/i.test(u.pathname)
      );
    } catch {
      return false;
    }
  });
  return (
    <section className="panel license-summary">
      <h3>{t('Лицензия и оператор', 'Лицензия және оператор')}</h3>
      {registry?.matches.length ? (
        registry.matches.map((match, i) => (
          <div key={i}>
            <p>
              <strong>{match.organization.replace(/\\"/g, '"')}</strong>
            </p>
            <dl>
              <dt>{t('Номер лицензии', 'Лицензия нөмірі')}</dt>
              <dd>{match.license}</dd>
              <dt>{t('БИН', 'БСН')}</dt>
              <dd>{match.bin}</dd>
              <dt>{t('Сайт в реестре', 'Тізілімдегі сайт')}</dt>
              <dd>{match.website}</dd>
              <dt>{t('Дата реестра', 'Тізілім күні')}</dt>
              <dd>{registry.sourceDate}</dd>
              <dt>{t('Основание совпадения', 'Сәйкестік негізі')}</dt>
              <dd>
                {match.matchedBy.includes('exact_domain')
                  ? t('Точный домен сайта', 'Сайттың нақты домені')
                  : t(
                      'БИН, заявленный на сайте; принадлежность требует проверки',
                      'Сайтта көрсетілген БСН; тиесілілігін тексеру қажет',
                    )}
              </dd>
            </dl>
            <p>
              {t(
                'Совпадение найдено в сохранённом реестре. Действие лицензии на дату этой проверки не подтверждено.',
                'Сақталған тізілімде сәйкестік табылды. Осы тексеру күніндегі лицензияның күші расталмады.',
              )}
            </p>
          </div>
        ))
      ) : (
        <p>
          {registry
            ? t(
                'В проверенном реестре совпадений нет. Это не доказывает отсутствие лицензии.',
                'Тексерілген тізілімде сәйкестік жоқ. Бұл лицензияның жоқтығын дәлелдемейді.',
              )
            : t(
                'Лицензия не проверена: запись официального реестра не получена.',
                'Лицензия тексерілмеді: ресми тізілім жазбасы алынбады.',
              )}
        </p>
      )}
      {source && (
        <p>
          <a
            href={source.sourceUrl || `/api/cases/${c.id}/evidence/${source.id}`}
            target="_blank"
            rel="noreferrer"
          >
            {t('Источник: реестр лицензий', 'Дереккөз: лицензиялар тізілімі')} ·{' '}
            {registry?.sourceDate}
          </a>
          {' · '}
          <a href={`/api/cases/${c.id}/evidence/${source.id}`} download>
            {t('Сохранённая копия', 'Сақталған көшірме')}
          </a>
        </p>
      )}
      {claims.map((o) => (
        <p key={o.id}>
          {t('Заявление сайта: ', 'Сайт мәлімдемесі: ')}
          {o.value}
          {' · '}
          <a
            href={o.sourceUrl || `/api/cases/${c.id}/evidence/${o.evidenceId}`}
            target="_blank"
            rel="noreferrer"
          >
            {t('Источник', 'Дереккөз')}
          </a>
        </p>
      ))}
      {documents.map((url) => (
        <p key={url}>
          <a href={url} target="_blank" rel="noreferrer">
            {t('Копия лицензии по ссылке с сайта', 'Сайттағы сілтеме бойынша лицензия көшірмесі')}
          </a>
          {' — '}
          {t(
            'публикация сайта; текущий статус не подтверждает',
            'сайт жарияланымы; қазіргі мәртебені растамайды',
          )}
        </p>
      ))}
    </section>
  );
}
