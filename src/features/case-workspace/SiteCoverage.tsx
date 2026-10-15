import type { CaseRecord, Lang } from '../../../shared/types';
export function SiteCoverage({ c, lang }: { c: CaseRecord; lang: Lang }) {
  const coverage = c.osint?.stages.find((s) => s.id === 'site-exploration');
  if (!coverage) return null;
  return (
    <section className="panel">
      <h3>{lang === 'ru' ? 'Какие страницы проверены' : 'Қандай беттер тексерілді'}</h3>
      <p>{coverage.summary[lang]}</p>
      <details>
        <summary>{lang === 'ru' ? 'Открыть список страниц' : 'Беттер тізімін ашу'}</summary>
        <ul>
          {coverage.pages
            ? coverage.pages.map((p) => (
                <li key={p.url}>
                  <a href={p.url} target="_blank" rel="noreferrer">
                    {p.url}
                  </a>{' '}
                  —{' '}
                  {p.status === 'available'
                    ? lang === 'ru'
                      ? 'Содержимое получено'
                      : 'Мазмұны алынды'
                    : lang === 'ru'
                      ? 'Содержимое не получено'
                      : 'Мазмұны алынбады'}
                </li>
              ))
            : [
                ...new Set(
                  c.evidence
                    .filter((e) => coverage.evidenceIds.includes(e.id) && e.sourceUrl)
                    .map((e) => e.sourceUrl!),
                ),
              ].map((url) => (
                <li key={url}>
                  <a href={url} target="_blank" rel="noreferrer">
                    {url}
                  </a>
                </li>
              ))}
        </ul>
      </details>
    </section>
  );
}
