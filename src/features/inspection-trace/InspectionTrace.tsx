import type { CaseRecord, Lang } from '../../../shared/types';
import { translator } from '../../i18n/translate.ts';
import { levelName } from '../../../shared/inspection';
import { InspectionStageDetail } from './InspectionStageDetail.tsx';
type Props = {
  inspection: NonNullable<CaseRecord['inspection']>;
  analysisLevel: CaseRecord['analysisLevel'];
  lang: Lang;
};
export function InspectionTrace({ inspection, analysisLevel, lang }: Props) {
  const t = translator(lang);
  return (
    <details className="inspection-trace panel">
      <summary>
        {levelName(analysisLevel)[lang]} ·{' '}
        {inspection.status === 'partial'
          ? t('Частичная проверка', 'Ішінара тексеру')
          : t('Проверки завершены', 'Тексерулер аяқталды')}
      </summary>
      <p className="muted">
        {t('Этапов ИИ', 'AI кезеңдері')}: {inspection.aiCalls}
      </p>
      {inspection.stages.map((stage) => (
        <InspectionStageDetail key={stage.id} stage={stage} lang={lang} />
      ))}
    </details>
  );
}
