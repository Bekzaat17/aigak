import { ArrowRight } from 'lucide-react';
import type { CaseRecord, Lang } from '../../../shared/types';
import { contentVerdict, primaryMaterials } from '../../case-view';

export function ResultSummary({
  c,
  lang,
  onReview,
}: {
  c: CaseRecord;
  lang: Lang;
  onReview: () => void;
}) {
  const t = (ru: string, kk: string) => (lang === 'ru' ? ru : kk);
  const verdict = contentVerdict(c);
  const headlines = {
    confirmed: t('Игорный контент подтверждён', 'Ойын мазмұны расталды'),
    indicators:
      c.sourceType === 'url'
        ? t('Найдены признаки игорного сайта', 'Ойын сайтының белгілері табылды')
        : t('Найдены признаки игорного контента', 'Ойын мазмұнының белгілері табылды'),
    not_found: t('Игорный контент не обнаружен', 'Ойын мазмұны анықталмады'),
    insufficient: t('Недостаточно данных для вывода', 'Қорытындыға деректер жеткіліксіз'),
    rejected: t('Найденные признаки отклонены', 'Табылған белгілер қабылданбады'),
  };
  const pending = c.findings.filter((f) => f.decision === 'pending').length;
  const accepted = c.findings.filter((f) => f.decision === 'accepted').length;
  const partial =
    c.inspection?.status === 'partial' || c.osint?.status === 'partial' || c.status === 'failed';
  return (
    <section className="result-summary">
      <div className="summary-main">
        <span className="eyebrow">
          {c.status === 'verified'
            ? t('ПРОВЕРЕНО ИНСПЕКТОРОМ', 'ИНСПЕКТОР ТЕКСЕРГЕН')
            : t('ГЛАВНЫЙ ВЫВОД', 'НЕГІЗГІ ҚОРЫТЫНДЫ')}
        </span>
        <h2>{headlines[verdict]}</h2>
        {c.assessment[lang].length > 400 ? (
          <details className="summary-explanation">
            <summary>{t('Развёрнутый вывод анализа', 'Талдаудың толық қорытындысы')}</summary>
            <p>{c.assessment[lang]}</p>
          </details>
        ) : (
          <p>{c.assessment[lang]}</p>
        )}
        <span className="summary-note">
          {verdict === 'confirmed'
            ? t(
                'Подтверждено инспектором по сохранённым материалам.',
                'Сақталған материалдар бойынша инспектор растады.',
              )
            : verdict === 'indicators'
              ? t(
                  'Пока не подтверждено. Сверьте находки с источниками ниже.',
                  'Әзірге расталмаған. Белгілерді төмендегі дереккөздермен салыстырыңыз.',
                )
              : t(
                  'Вывод относится к полученным материалам. Правовая оценка — в разделе «Закон».',
                  'Қорытынды алынған материалдарға қатысты. Құқықтық бағалау «Заң» бөлімінде.',
                )}
        </span>
        {c.likelihood !== null && (
          <details className="score-detail">
            <summary>
              {t('Оценка ИИ', 'AI бағасы')}: {Math.round(c.likelihood)}%
            </summary>
            <p>
              {t(
                'Неоткалиброванная оценка наличия игорного предложения, а не вероятности нарушения закона.',
                'Заң бұзушылықтың емес, ойын ұсынысының калибрленбеген бағасы.',
              )}
            </p>
          </details>
        )}
      </div>
      <div className="summary-next">
        <span className="eyebrow">{t('ВАШ СЛЕДУЮЩИЙ ШАГ', 'КЕЛЕСІ ҚАДАМЫҢЫЗ')}</span>
        <strong>
          {pending
            ? t(`Осталось проверить: ${pending}`, `Тексеру қалды: ${pending}`)
            : c.findings.length
              ? t('Завершите проверку', 'Тексеруді аяқтаңыз')
              : t('Проверьте полноту материалов', 'Материалдардың толықтығын тексеріңіз')}
        </strong>
        <p>
          {pending
            ? t(
                'Откройте находку, сравните с источником и отметьте своё решение.',
                'Белгіні ашып, дереккөзбен салыстырыңыз және шешіміңізді белгілеңіз.',
              )
            : t(
                'Проверьте контекст и укажите, достаточно ли полученных данных.',
                'Мәнмәтінді тексеріп, алынған деректердің жеткіліктілігін көрсетіңіз.',
              )}
        </p>
        <button className="secondary" onClick={onReview}>
          {pending ? t('К находкам', 'Белгілерге өту') : t('К проверке', 'Тексеруге өту')}
          <ArrowRight size={16} />
        </button>
      </div>
      <div className="summary-facts">
        <span>
          {t('Находки', 'Белгілер')}
          <strong>{c.findings.length}</strong>
        </span>
        <span>
          {t('Подтверждено вами', 'Сіз растадыңыз')}
          <strong>{accepted}</strong>
        </span>
        <span>
          {t('Исходные материалы', 'Бастапқы материалдар')}
          <strong>{primaryMaterials(c).length}</strong>
        </span>
        <span className={partial ? 'coverage-warning' : ''}>
          {!c.inspection
            ? t('Ход этапов не сохранён', 'Кезеңдер барысы сақталмаған')
            : partial
              ? t('Есть ограничения сбора', 'Жинауда шектеулер бар')
              : t('Этапы анализа завершены', 'Талдау кезеңдері аяқталды')}
        </span>
      </div>
    </section>
  );
}
