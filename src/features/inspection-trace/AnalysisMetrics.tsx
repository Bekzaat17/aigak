import type { CaseRecord, Lang } from '../../../shared/types';
import { translator } from '../../i18n/translate';
import { TokenUsage } from './TokenUsage';
import { formatDuration } from '../../lib/format-duration';

type Props = {
  current: Pick<CaseRecord, 'createdAt' | 'completedAt' | 'audit' | 'inspection'>;
  lang: Lang;
};
export function AnalysisMetrics({ current, lang }: Props) {
  const t = translator(lang);
  const start =
    [...current.audit].reverse().find((event) => event.action === 'revision.started')?.at ??
    current.createdAt;
  const inspection =
    current.inspection && Date.parse(current.inspection.startedAt) >= Date.parse(start)
      ? current.inspection
      : undefined;
  const duration = current.completedAt
    ? Date.parse(current.completedAt) - Date.parse(start)
    : undefined;
  const analysisDuration = inspection
    ? Date.parse(inspection.completedAt) - Date.parse(inspection.startedAt)
    : undefined;
  return (
    <section
      className="analysis-metrics panel"
      aria-label={t('Время и расход анализа', 'Талдау уақыты мен шығыны')}
    >
      <h3>{t('Время и расход анализа', 'Талдау уақыты мен шығыны')}</h3>
      <dl>
        <div>
          <dt>{t('Весь цикл', 'Толық цикл')}</dt>
          <dd>{formatDuration(duration, lang)}</dd>
        </div>
        <div>
          <dt>{t('Проверка материалов', 'Материалдарды тексеру')}</dt>
          <dd>{formatDuration(analysisDuration, lang)}</dd>
        </div>
        <div>
          <dt>{t('Запросы к ИИ', 'AI сұраулары')}</dt>
          <dd>{inspection ? (inspection.aiAttempts ?? t('нет данных', 'дерек жоқ')) : '—'}</dd>
        </div>
      </dl>
      {inspection ? (
        <TokenUsage
          attempts={inspection.stages.flatMap((stage) => stage.aiAttempts ?? [])}
          expectedAttempts={inspection.aiAttempts ?? inspection.aiCalls}
          lang={lang}
        />
      ) : (
        <p>{t('Расход токенов неизвестен', 'Токен шығыны белгісіз')}</p>
      )}
      <p className="muted">
        {t(
          'Текущий запуск. Весь цикл включает ожидание и сбор материалов. Токены — по данным провайдера, включая повторы; прерванные запросы могут быть не учтены.',
          'Ағымдағы іске қосу. Толық цикл күту мен материал жинауды қамтиды. Токендер провайдер деректері бойынша, қайталаулармен бірге; үзілген сұраулар есепке алынбауы мүмкін.',
        )}
      </p>
    </section>
  );
}
