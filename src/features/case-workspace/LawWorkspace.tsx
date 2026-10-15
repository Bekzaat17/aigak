import { AuthenticationSummary } from './AuthenticationSummary';
import { LicenseSummary } from './LicenseSummary';
import { AccessObservations } from './AccessObservations';
import { LegalSourceLink } from './LegalSourceLink';
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
  const legalStage = c.inspection?.stages.find((s) => s.id === 'legal');
  return (
    <section className="law-workspace">
      <div className="workspace-heading">
        <div>
          <h2>{t('Правовая оценка', 'Құқықтық бағалау')}</h2>
          <p>
            {t(
              'Лицензия, возможные нарушения и официальные правовые основания.',
              'Норма → негіз → тағы не растау қажет. Мұндағы қорытындылар — болжамдар.',
            )}
          </p>
        </div>
        <ShieldCheck size={24} />
      </div>
      <LicenseSummary c={c} lang={lang} />
      <section className="panel">
        <h3>{t('Правонарушения', 'Құқық бұзушылықтар')}</h3>
        {!hypotheses.length && (
          <p>
            <strong>
              {legalStage?.status === 'completed'
                ? t(
                    'Оснований для вывода о конкретном нарушении не установлено.',
                    'Нақты құқық бұзушылық туралы қорытындыға негіздер анықталмады.',
                  )
                : t('Правовая проверка не завершена.', 'Құқықтық тексеру аяқталмады.')}
            </strong>
          </p>
        )}
        {hypotheses.length > 0 && (
          <p>
            {t(
              'Ниже — возможные нарушения, требующие проверки условий применения нормы.',
              'Төменде норманы қолдану шарттарын тексеруді қажет ететін ықтимал бұзушылықтар берілген.',
            )}
          </p>
        )}
        {legalStage?.summary && <p>{legalStage.summary[lang]}</p>}
        {!legalStage && (
          <p>
            {t(
              'Запустите проверку Pro для сопоставления находок с законодательством.',
              'Белгілерді заңнамамен салыстыру үшін Pro тексеруін іске қосыңыз.',
            )}
          </p>
        )}
      </section>
      {hypotheses.map((h, i) => {
        const norm = c.osint?.legalNorms?.find((n) => n.id === h.normId);
        return (
          <article className="finding-detail" key={i}>
            <span className="eyebrow">{t('ПРАВОВАЯ ГИПОТЕЗА', 'ҚҰҚЫҚТЫҚ БОЛЖАМ')}</span>
            <h2>
              <LegalSourceLink norm={norm} lang={lang} />
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
                    href={
                      /\/docs\/[0-9a-f-]{36}$/.test(norm.sourceUrl)
                        ? norm.sourceUrl + '?tab=history'
                        : norm.sourceUrl + '/history'
                    }
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
      <AuthenticationSummary c={c} lang={lang} />
      <AccessObservations c={c} lang={lang} />
      {!!c.osint?.legalNorms?.length && (
        <section className="panel legal-references">
          <h3>{t('Законы, использованные при проверке', 'Тексеруде қолданылған заңдар')}</h3>
          <p>
            {t(
              'Справочные основания. Наличие статьи в этом списке само по себе не означает нарушение.',
              'Анықтамалық негіздер. Баптың бұл тізімде болуы бұзушылықты білдірмейді.',
            )}
          </p>
          {c.osint.legalNorms.map((n) => (
            <article key={n.id}>
              <h4>
                <LegalSourceLink norm={n} lang={lang} />
              </h4>
              <p>{n.quote.split('\n')[0]}</p>
              <details>
                <summary>
                  {t('Текст статьи и сохранённый источник', 'Бап мәтіні және сақталған дереккөз')}
                </summary>
                <blockquote className="finding-quote">{n.quote}</blockquote>
                <a href={`/api/cases/${c.id}/evidence/${n.evidenceId}`} download>
                  {t('Скачать сохранённый официальный текст', 'Сақталған ресми мәтінді жүктеу')}
                </a>
                <p>
                  {t('Получено: ', 'Алынған күні: ')}
                  {n.retrievedAt.slice(0, 10)}.{' '}
                  {t(
                    'Редакция на дату события требует сверки.',
                    'Оқиға күніндегі редакцияны салыстыру қажет.',
                  )}
                </p>
              </details>
            </article>
          ))}
        </section>
      )}
    </section>
  );
}
