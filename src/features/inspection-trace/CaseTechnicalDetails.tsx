import type { CaseRecord, Lang } from '../../../shared/types';
import { translator } from '../../i18n/translate.ts';
import { AuditTimeline } from './AuditTimeline.tsx';
import { InspectionTrace } from './InspectionTrace.tsx';
type Props = { current: Pick<CaseRecord, 'inspection' | 'analysisLevel' | 'audit'>; lang: Lang };
export function CaseTechnicalDetails({ current, lang }: Props) {
  const t = translator(lang);
  return (
    <details className="technical-details">
      <summary>
        {t(
          'Как проводился анализ · этапы и журнал',
          'Талдау қалай жүргізілді · кезеңдер мен журнал',
        )}
      </summary>
      {current.inspection && (
        <InspectionTrace
          inspection={current.inspection}
          analysisLevel={current.analysisLevel}
          lang={lang}
        />
      )}
      {<AuditTimeline audit={current.audit} lang={lang} />}
    </details>
  );
}
