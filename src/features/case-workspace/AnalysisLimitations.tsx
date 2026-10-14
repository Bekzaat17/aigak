import type { CaseRecord, Lang } from '../../../shared/types';
import { translator } from '../../i18n/translate.ts';
import { AlertCircle, ChevronDown } from 'lucide-react';
type Props = { current: Pick<CaseRecord, 'issues' | 'status'>; lang: Lang };
export function AnalysisLimitations({ current, lang }: Props) {
  const t = translator(lang);
  return (
    <details className="limitations" open={current.status === 'failed'}>
      <summary>
        <AlertCircle size={18} />
        {t('Ограничения анализа', 'Талдау шектеулері')}
        <span>{current.issues.length}</span>
        <ChevronDown size={17} />
      </summary>
      <ul>
        {current.issues.map((i, n) => (
          <li key={n}>{i[lang]}</li>
        ))}
      </ul>
    </details>
  );
}
