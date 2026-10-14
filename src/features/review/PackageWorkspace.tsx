import type { CaseScreenProps } from '../case-workspace/contracts.ts';
import { LegalReviewForm } from '../dossier/LegalReviewForm.tsx';
import { PackagePreview } from './PackagePreview.tsx';
import { ReviewCycle } from '../review-cycle/ReviewCycle.tsx';
import { ReviewForm } from './ReviewForm.tsx';
import { ClarificationPanel } from './ClarificationPanel.tsx';
import { PackageDownloadCard } from './PackageDownloadCard.tsx';
type Props = Pick<
  CaseScreenProps,
  | 'current'
  | 'lang'
  | 'setCurrent'
  | 'templates'
  | 'busy'
  | 'run'
  | 'answerClarification'
  | 'approveReview'
  | 'exportZip'
>;
export function PackageWorkspace({
  current,
  lang,
  setCurrent,
  templates,
  busy,
  run,
  answerClarification,
  approveReview,
  exportZip,
}: Props) {
  return (
    <div className="package-layout">
      <div>
        {current.analysisLevel === 'pro' && (
          <LegalReviewForm
            key={'legal:' + current.id + ':' + (current.revisions?.length || 0)}
            c={current}
            lang={lang}
            onChange={setCurrent}
          />
        )}
        <PackagePreview c={current} lang={lang} templates={templates} onChange={setCurrent} />
        <ReviewCycle
          key={current.id + ':' + (current.revisions?.length || 0)}
          c={current}
          lang={lang}
          busy={busy}
          update={setCurrent}
          run={run}
        />
        <ClarificationPanel
          questions={current.clarifications}
          lang={lang}
          busy={busy}
          answerClarification={answerClarification}
        />
        <ReviewForm
          key={current.id}
          current={current}
          lang={lang}
          busy={busy}
          save={approveReview}
        />
      </div>
      <aside>
        <PackageDownloadCard current={current} lang={lang} busy={busy} exportZip={exportZip} />
      </aside>
    </div>
  );
}
