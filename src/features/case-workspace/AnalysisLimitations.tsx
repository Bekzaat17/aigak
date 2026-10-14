import { currentIssues } from '../../../shared/current-issues';
import type { CaseRecord, Lang } from '../../../shared/types';
import { translator } from '../../i18n/translate.ts';
import { AlertCircle, ChevronDown } from 'lucide-react';
type Props = {
  current: Pick<CaseRecord, 'issues' | 'status' | 'inspection'> &
    Partial<Pick<CaseRecord, 'findings'>>;
  lang: Lang;
};
export function AnalysisLimitations({ current, lang }: Props) {
  const t = translator(lang);
  const issues = currentIssues({ ...current, findings: current.findings || [] });
  if (!issues.length) return null;
  return (
    <details className="limitations" open={current.status === 'failed'}>
      <summary>
        <AlertCircle size={18} />
        {t('Ограничения анализа', 'Талдау шектеулері')}
        <span>{issues.length}</span>
        <ChevronDown size={17} />
      </summary>
      <ul>
        {issues.map((i, n) => (
          <li key={n}>{i[lang]}</li>
        ))}
      </ul>
    </details>
  );
}
