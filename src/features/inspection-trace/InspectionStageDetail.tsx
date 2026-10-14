import { LegalSourceLink } from '../case-workspace/LegalSourceLink';
import type { CaseRecord, Lang } from '../../../shared/types';
import { translator } from '../../i18n/translate.ts';
import { reviewLabels } from '../../../shared/inspection-presentation';
import { TokenUsage } from './TokenUsage';
import { formatDuration } from '../../lib/format-duration';
type Props = {
  stage: NonNullable<CaseRecord['inspection']>['stages'][number];
  lang: Lang;
  norms?: NonNullable<CaseRecord['osint']>['legalNorms'];
};
export function InspectionStageDetail({ stage, lang, norms }: Props) {
  const t = translator(lang);
  return (
    <article>
      <strong>{stage.name[lang]}</strong>
      <small>
        {stage.status === 'completed'
          ? t('Выполнено', 'Орындалды')
          : stage.status === 'partial'
            ? t('Частично', 'Ішінара')
            : stage.status === 'skipped'
              ? t('Пропущено', 'Өткізілді')
              : t('Ошибка', 'Қате')}{' '}
        · v{stage.version} · {formatDuration(stage.durationMs, lang)}
      </small>
      <TokenUsage
        attempts={stage.aiAttempts ?? []}
        expectedAttempts={stage.aiAttempts === undefined ? 1 : undefined}
        lang={lang}
      />
      <p>{stage.summary[lang]}</p>
      {stage.aiAttempts?.map((a, i) => (
        <p className="muted" key={i}>
          {a.profile} · {a.actualModel || a.requestedModel} ·{' '}
          {a.status === 'completed' ? t('Ответ получен', 'Жауап алынды') : t('Ошибка', 'Қате')} ·{' '}
          {formatDuration(a.durationMs, lang)}
          <TokenUsage attempts={[a]} lang={lang} />
          <br />
          {a.promptVersion} · {a.schemaVersion}
        </p>
      ))}
      {stage.review && (
        <div className="rule-details">
          <strong>{reviewLabels[stage.review.status][lang]}</strong>
          {stage.review.uncertainties.map((u, i) => (
            <p key={i}>{u[lang]}</p>
          ))}
          {stage.review.contradictions.map((c, i) => (
            <blockquote key={i}>
              «{c.quote}»<small>{c.explanation[lang]}</small>
            </blockquote>
          ))}
          {stage.review.questions.length > 0 && (
            <>
              <strong>{t('Нужно уточнить у инспектора', 'Инспектордан нақтылау қажет')}</strong>
              <ul>
                {stage.review.questions.map((q, i) => (
                  <li key={i}>{q[lang]}</li>
                ))}
              </ul>
            </>
          )}
        </div>
      )}
      {stage.legalHypotheses?.map((h, i) => (
        <div key={'legal-' + i} className="rule-details">
          <strong>
            {t(
              'Правовая гипотеза — требует подтверждения',
              'Құқықтық болжам — растауды қажет етеді',
            )}{' '}
            <LegalSourceLink norm={norms?.find((n) => n.id === h.normId)} lang={lang} />
          </strong>
          <blockquote>{h.normQuote}</blockquote>
          <p>{h.reason[lang]}</p>
          <small>
            {t('Наблюдения', 'Бақылаулар')}: {h.findingIds.join(', ')}
          </small>
          <ul>
            {h.missing.map((m, j) => (
              <li key={j}>{m[lang]}</li>
            ))}
          </ul>
        </div>
      ))}
      {stage.observations.length > 0 && (
        <details>
          <summary>
            {t('Наблюдения этапа', 'Кезең бақылаулары')} ({stage.observations.length})
          </summary>
          {stage.observations.map((f) => (
            <blockquote key={f.id}>
              {f.quote}
              <small>{f.explanation[lang]}</small>
            </blockquote>
          ))}
        </details>
      )}
    </article>
  );
}
