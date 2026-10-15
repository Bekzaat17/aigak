import type { CaseRecord, Lang } from '../../../shared/types';
export function ResourceHistory({ current, lang }: { current: CaseRecord; lang: Lang }) {
  const t = (ru: string, kk: string) => (lang === 'ru' ? ru : kk);
  const stages =
    current.osint?.stages.filter((s) =>
      ['kaznic-whois', 'archive-history', 'certificate-history'].includes(s.id),
    ) || [];
  if (!stages.length) return null;
  const observations = current.osint?.observations || [];
  const archives = observations
    .filter((o) => o.kind === 'archive_snapshot')
    .flatMap((o) => {
      try {
        const s: unknown = JSON.parse(o.value);
        if (
          !s ||
          typeof s !== 'object' ||
          !('url' in s) ||
          !('date' in s) ||
          typeof s.url !== 'string' ||
          typeof s.date !== 'string'
        )
          return [];
        const u = new URL(s.url);
        if (u.protocol !== 'https:' || u.hostname !== 'web.archive.org') return [];
        return [{ ...o, url: u.href, date: s.date }];
      } catch {
        return [];
      }
    });
  const names = observations.filter((o) => o.kind === 'historical_certificate_name');
  return (
    <section className="panel">
      <h3>{t('История и публичная регистрация', 'Тарих және ашық тіркелу деректері')}</h3>
      {observations.some((o) => o.kind === 'registrant_privacy') && (
        <p>
          {t(
            'KazNIC скрывает сведения об организации-регистранте. Владелец по этому источнику не установлен.',
            'KazNIC тіркелуші ұйым туралы деректерді жасырады. Бұл дереккөз бойынша иесі анықталмады.',
          )}
        </p>
      )}
      {archives.map((o) => (
        <article key={o.id}>
          <h4>
            <a href={o.url} target="_blank" rel="noreferrer">
              {t('Архивная копия от ', 'Мұрағат көшірмесі: ')}
              {o.date}
            </a>
          </h4>
          <p>
            {t(
              'Ссылка подтверждена архивным индексом; содержимое копии не проверено и не доказывает текущее состояние сайта.',
              'Сілтеме мұрағат индексімен расталған; көшірме мазмұны тексерілмеген және сайттың қазіргі күйін дәлелдемейді.',
            )}
          </p>
          <a href={`/api/cases/${current.id}/evidence/${o.evidenceId}`} download>
            {t('Сохранённый ответ архива', 'Мұрағаттың сақталған жауабы')}
          </a>
        </article>
      ))}
      {!!names.length && (
        <details>
          <summary>
            {t('Имена из истории сертификатов', 'Сертификаттар тарихындағы атаулар')} (
            {names.length})
          </summary>
          <p>
            {t(
              'Это исторические технические следы, а не подтверждённые зеркала или сайты общего владельца.',
              'Бұл тарихи техникалық деректер, расталған айналар немесе ортақ иенің сайттары емес.',
            )}
          </p>
          <ul>
            {names.map((o) => (
              <li key={o.id}>{o.value}</li>
            ))}
          </ul>
        </details>
      )}
      {stages.map((s) => (
        <p key={s.id}>
          {s.status === 'failed'
            ? t(
                `${s.id === 'kaznic-whois' ? 'Регистрация KazNIC' : s.id === 'archive-history' ? 'Архив сайта' : 'История сертификатов'}: проверяемые сведения не получены. Это не означает отсутствия записей.`,
                `${s.id === 'kaznic-whois' ? 'KazNIC тіркелуі' : s.id === 'archive-history' ? 'Сайт мұрағаты' : 'Сертификаттар тарихы'}: тексерілетін мәліметтер алынбады. Бұл жазбалардың жоқтығын білдірмейді.`,
              )
            : s.summary[lang]}
        </p>
      ))}
    </section>
  );
}
