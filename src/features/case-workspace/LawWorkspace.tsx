import { ArrowRight, Download, ShieldCheck } from 'lucide-react';
import type { CaseRecord, Lang } from '../../../shared/types';

export function LawWorkspace({
  c,
  lang,
  onFinding,
}: {
  c: CaseRecord;
  lang: Lang;
  onFinding: () => void;
}) {
  const t = (ru: string, kk: string) => (lang === 'ru' ? ru : kk);
  const hypotheses = c.inspection?.stages.flatMap((s) => s.legalHypotheses || []) || [];
  return (
    <section className="law-workspace">
      <div className="workspace-heading">
        <div>
          <h2>{t('Правовая оценка', 'Құқықтық бағалау')}</h2>
          <p>
            {t(
              'Норма → основание → что ещё нужно подтвердить. Все выводы здесь — гипотезы.',
              'Норма → негіз → тағы не растау қажет. Мұндағы қорытындылар — болжамдар.',
            )}
          </p>
        </div>
        <ShieldCheck size={24} />
      </div>
      {!hypotheses.length && (
        <div className="empty-result">
          <h3>{t('Правовые гипотезы не сформированы', 'Құқықтық болжамдар жасалмады')}</h3>
          <p>
            {c.analysisLevel !== 'pro'
              ? t(
                  'Юридическая проверка доступна в режиме Pro.',
                  'Құқықтық тексеру Pro режимінде қолжетімді.',
                )
              : t(
                  'Проверьте доступность ИИ и источников. Отсутствие гипотезы не означает отсутствие нарушения.',
                  'AI мен дереккөздердің қолжетімділігін тексеріңіз. Болжамның болмауы заң бұзушылықтың жоқтығын білдірмейді.',
                )}
          </p>
        </div>
      )}
      {hypotheses.map((h, i) => {
        const norm = c.osint?.legalNorms?.find((n) => n.id === h.normId);
        return (
          <article className="finding-detail" key={i}>
            <span className="eyebrow">{t('ПРАВОВАЯ ГИПОТЕЗА', 'ҚҰҚЫҚТЫҚ БОЛЖАМ')}</span>
            <h2>
              {t('Статья', 'Бап')} {norm?.article || '—'} ·{' '}
              {norm?.title?.[lang] || t('Об игорном бизнесе', 'Ойын бизнесі туралы')}
            </h2>
            <p>{h.reason[lang]}</p>
            <details>
              <summary>
                {t('Точный текст нормы и источник', 'Норманың нақты мәтіні және дереккөз')}
              </summary>
              <blockquote className="finding-quote">{h.normQuote}</blockquote>
              {norm && (
                <>
                  <a
                    className="text-button"
                    href={norm.sourceUrl + '/history'}
                    target="_blank"
                    rel="noreferrer"
                  >
                    {t('Редакции в официальном источнике', 'Ресми дереккөздегі редакциялар')}
                  </a>
                  <a
                    className="text-button"
                    href={`/api/cases/${c.id}/evidence/${norm.evidenceId}`}
                    download
                  >
                    {t('Сохранённый текст закона', 'Заңның сақталған мәтіні')}
                    <Download size={15} />
                  </a>
                </>
              )}
            </details>
            <section>
              <h3>{t('На каких находках основано', 'Қандай белгілерге негізделген')}</h3>
              {h.findingIds.map((id) => {
                const f =
                  c.findings.find((f) => f.id === id) ||
                  c.inspection?.stages.flatMap((s) => s.observations).find((f) => f.id === id);
                return f ? <blockquote key={id}>«{f.quote}»</blockquote> : null;
              })}
              <button className="text-button" onClick={onFinding}>
                {t('Сверить с находками', 'Белгілермен салыстыру')}
                <ArrowRight size={15} />
              </button>
            </section>
            <section className="decision-area">
              <h3>{t('Нужно подтвердить', 'Растау қажет')}</h3>
              <ul>
                {h.missing.map((m, j) => (
                  <li key={j}>{m[lang]}</li>
                ))}
              </ul>
              <p>
                {t(
                  'Инспектор проверяет редакцию закона на дату события и условия применения.',
                  'Инспектор оқиға күніндегі заң редакциясын және қолдану шарттарын тексереді.',
                )}
              </p>
            </section>
          </article>
        );
      })}
      {!!c.osint?.legalNorms?.length && (
        <details className="technical-details">
          <summary>
            {t(
              'Какие нормы были доступны при анализе',
              'Талдау кезінде қандай нормалар қолжетімді болды',
            )}
          </summary>
          {c.osint.legalNorms.map((n) => (
            <p key={n.id}>
              {t('Статья', 'Бап')} {n.article} ·{' '}
              <a href={`/api/cases/${c.id}/evidence/${n.evidenceId}`} download>
                {t('Сохранённый официальный текст', 'Сақталған ресми мәтін')}
              </a>
            </p>
          ))}
        </details>
      )}
    </section>
  );
}
