import { resultDiagnostic } from './result-diagnostic';
import { ArrowRight } from 'lucide-react';
import type { CaseRecord, Lang } from '../../../shared/types';
import { contentVerdict, primaryMaterials } from '../../case-view';

export function ResultSummary({
  c,
  lang,
  onReview,
  onDetails,
}: {
  c: CaseRecord;
  lang: Lang;
  onReview: () => void;
  onDetails?: () => void;
}) {
  const t = (ru: string, kk: string) => (lang === 'ru' ? ru : kk);
  const verdict = contentVerdict(c);
  const diagnostic = resultDiagnostic(c, lang);
  const explanation = diagnostic?.explanation || c.assessment[lang];
  const attempts = c.collection?.attempts || [];
  const failedStages = c.inspection?.stages.filter((s) => s.status === 'failed') || [];
  const headlines = {
    confirmed: t('Игорный контент подтверждён', 'Ойын мазмұны расталды'),
    indicators:
      c.sourceType === 'url'
        ? t('Найдены признаки игорного сайта', 'Ойын сайтының белгілері табылды')
        : t('Найдены признаки игорного контента', 'Ойын мазмұнының белгілері табылды'),
    not_found: t('Признаки игорного предложения не найдены', 'Ойын ұсынысының белгілері табылмады'),
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
        <h2>{diagnostic?.title || headlines[verdict]}</h2>
        {explanation.length > 400 ? (
          <details className="summary-explanation">
            <summary>{t('Развёрнутый вывод анализа', 'Талдаудың толық қорытындысы')}</summary>
            <p>{explanation}</p>
          </details>
        ) : (
          <p>{explanation}</p>
        )}
        <span className="summary-note">
          {diagnostic
            ? t(
                'Это результат выполнения проверки, а не вывод об отсутствии нарушений.',
                'Бұл тексерудің орындалу нәтижесі, құқық бұзушылықтардың жоқтығы туралы қорытынды емес.',
              )
            : verdict === 'confirmed'
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
        {!diagnostic && c.likelihood !== null && (
          <details className="score-detail">
            <summary>
              {t(
                'Вероятность игорного предложения · оценка ИИ',
                'Ойын ұсынысының ықтималдығы · AI бағасы',
              )}
              : {Math.round(c.likelihood)}%
            </summary>
            <p>
              {t(
                'Неоткалиброванная оценка наличия игорного предложения, а не вероятности нарушения закона.',
                'Заң бұзушылықтың емес, ойын ұсынысының калибрленбеген бағасы.',
              )}
            </p>
          </details>
        )}
        {diagnostic && (attempts.length > 0 || failedStages.length > 0) && (
          <details className="summary-explanation">
            <summary>{t('Что произошло при проверке', 'Тексеру кезінде не болды')}</summary>
            <p>
              {t('Режим: ', 'Режим: ')}
              {c.analysisLevel === 'pro'
                ? 'Pro'
                : c.analysisLevel === 'advanced'
                  ? t('Расширенный', 'Кеңейтілген')
                  : t('Базовый', 'Негізгі')}{' '}
              · {c.useAi ? t('с ИИ', 'AI арқылы') : t('без ИИ', 'AI жоқ')}
            </p>
            <ul>
              {attempts.map((a, i) => (
                <li key={i}>
                  {a.method}: {a.errorCode || a.status} · {(a.durationMs / 1000).toFixed(1)}{' '}
                  {t('с', 'с')}
                </li>
              ))}
            </ul>
            {failedStages.map((s) => (
              <p key={s.id}>
                {s.name[lang]}: {s.summary[lang]}
              </p>
            ))}
          </details>
        )}
      </div>
      <div className="summary-next">
        <span className="eyebrow">{t('ВАШ СЛЕДУЮЩИЙ ШАГ', 'КЕЛЕСІ ҚАДАМЫҢЫЗ')}</span>
        <strong>
          {diagnostic
            ? t('Что делать дальше', 'Келесі әрекет')
            : pending
              ? t(`Осталось проверить: ${pending}`, `Тексеру қалды: ${pending}`)
              : c.findings.length
                ? t('Завершите проверку', 'Тексеруді аяқтаңыз')
                : t('Проверьте полноту материалов', 'Материалдардың толықтығын тексеріңіз')}
        </strong>
        <p>
          {diagnostic
            ? diagnostic.next
            : pending
              ? t(
                  'Откройте находку, сравните с источником и отметьте своё решение.',
                  'Белгіні ашып, дереккөзбен салыстырыңыз және шешіміңізді белгілеңіз.',
                )
              : t(
                  'Проверьте контекст и укажите, достаточно ли полученных данных.',
                  'Мәнмәтінді тексеріп, алынған деректердің жеткіліктілігін көрсетіңіз.',
                )}
        </p>
        <button className="secondary" onClick={diagnostic ? onDetails || onReview : onReview}>
          {diagnostic
            ? t('Причины и попытки', 'Себептер мен әрекеттер')
            : pending
              ? t('К находкам', 'Белгілерге өту')
              : t('К проверке', 'Тексеруге өту')}
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
          {diagnostic && attempts.length
            ? t(`Попыток доступа: ${attempts.length}`, `Қол жеткізу әрекеттері: ${attempts.length}`)
            : !c.inspection
              ? t('Анализ содержимого не выполнен', 'Мазмұн талданбады')
              : partial
                ? t('Есть ограничения сбора', 'Жинауда шектеулер бар')
                : t('Этапы анализа завершены', 'Талдау кезеңдері аяқталды')}
        </span>
      </div>
    </section>
  );
}
