import type { CaseRecord, Lang } from '../../../shared/types';

export function LegalCoverage({ c, lang }: { c: CaseRecord; lang: Lang }) {
  const failed =
    c.osint?.stages?.filter((s) => /^law-(?!attempt-)/.test(s.id) && s.status === 'failed') || [];
  if (!failed.length) return null;
  return (
    <section className="panel">
      <h3>
        {lang === 'ru'
          ? 'Какие правовые источники не удалось проверить'
          : 'Қандай құқықтық дереккөздер тексерілмеді'}
      </h3>
      <p>
        {lang === 'ru'
          ? 'Вывод ограничен полученными нормами. Неполный набор источников не подтверждает отсутствие нарушений.'
          : 'Қорытынды алынған нормалармен шектеледі. Дереккөздердің толық болмауы бұзушылықтардың жоқтығын растамайды.'}
      </p>
      <ul>
        {failed.map((s) => (
          <li key={s.id}>
            {s.summary[lang]}{' '}
            <a
              href={'https://adilet.zan.kz/rus/docs/' + encodeURIComponent(s.id.slice(4))}
              target="_blank"
              rel="noreferrer"
            >
              {lang === 'ru' ? 'Официальный источник' : 'Ресми дереккөз'}
            </a>
          </li>
        ))}
      </ul>
    </section>
  );
}
