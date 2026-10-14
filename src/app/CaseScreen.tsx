import { CollectionQuality } from '../features/case-workspace/CollectionQuality';
import { AnalysisProgress } from '../AnalysisProgress';
import { FindingsWorkspace } from '../features/case-workspace/FindingsWorkspace.tsx';
import { LawWorkspace } from '../features/case-workspace/LawWorkspace.tsx';
import { MaterialsWorkspace } from '../features/case-workspace/MaterialsWorkspace.tsx';
import { ResultSummary } from '../features/case-workspace/ResultSummary.tsx';
import { CaseHeader } from '../features/case-workspace/CaseHeader.tsx';
import { CaseTabs } from '../features/case-workspace/CaseTabs.tsx';
import { AnalysisLimitations } from '../features/case-workspace/AnalysisLimitations.tsx';
import { AnalysisMetrics } from '../features/inspection-trace/AnalysisMetrics.tsx';
import { CaseTechnicalDetails } from '../features/inspection-trace/CaseTechnicalDetails.tsx';
import { PackageWorkspace } from '../features/review/PackageWorkspace.tsx';
import { ResourceGraph } from '../features/resource-graph/ResourceGraph';
import { ReviewCycle } from '../features/review-cycle/ReviewCycle';
import { OsintPanel } from '../OsintPanel';
import type { CaseScreenProps } from '../features/case-workspace/contracts.ts';
export function CaseScreen({
  lang,
  current,
  setCurrent,
  busy,
  templates,
  tab,
  reviewFindings,
  run,
  saveFinding,
  answerClarification,
  approveReview,
  processing,
  openTab,
  reset,
  exportZip,
}: CaseScreenProps) {
  return (
    <section className="results">
      <CaseHeader
        current={current}
        lang={lang}
        busy={busy}
        processing={processing}
        reset={reset}
        exportZip={exportZip}
      />
      {processing ? (
        <AnalysisProgress c={current} lang={lang} />
      ) : (
        <>
          <ResultSummary c={current} lang={lang} onReview={reviewFindings} />
          <div id="result-sections" />
          <CaseTabs current={current} lang={lang} tab={tab} openTab={openTab} />
          {tab === 'analysis' && (
            <FindingsWorkspace
              onChange={setCurrent}
              key={current.id}
              c={current}
              lang={lang}
              busy={busy}
              save={saveFinding}
              onLaw={() => openTab('law')}
              onPackage={() => openTab('package')}
            />
          )}
          {tab === 'osint' && <OsintPanel current={current} lang={lang} onChange={setCurrent} />}
          {tab === 'evidence' && <MaterialsWorkspace key={current.id} c={current} lang={lang} />}
          {tab === 'law' && (
            <LawWorkspace c={current} lang={lang} onFinding={() => openTab('analysis')} />
          )}
          {tab === 'package' && (
            <PackageWorkspace
              current={current}
              lang={lang}
              setCurrent={setCurrent}
              templates={templates}
              busy={busy}
              run={run}
              answerClarification={answerClarification}
              approveReview={approveReview}
              exportZip={exportZip}
            />
          )}
          {tab === 'details' && (
            <section>
              <h2>
                {lang === 'ru' ? 'История и детали анализа' : 'Талдау тарихы мен мәліметтері'}
              </h2>
              <AnalysisMetrics current={current} lang={lang} />
              <CollectionQuality c={current} lang={lang} />
              <CaseTechnicalDetails current={current} lang={lang} />
              <details className="technical-details">
                <summary>
                  {lang === 'ru'
                    ? 'Технические связи и адреса серверов'
                    : 'Техникалық байланыстар және сервер мекенжайлары'}
                </summary>
                <ResourceGraph c={current} lang={lang} onChange={setCurrent} />
              </details>
              <ReviewCycle
                key={current.id + ':' + (current.revisions?.length || 0)}
                c={current}
                lang={lang}
                busy={busy}
                update={setCurrent}
                run={run}
              />
              {current.issues.length > 0 && <AnalysisLimitations current={current} lang={lang} />}
            </section>
          )}
        </>
      )}
    </section>
  );
}
