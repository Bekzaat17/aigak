import type { CaseScreenProps } from '../case-workspace/contracts';
import { LegalReviewForm } from '../dossier/LegalReviewForm';
import { PackagePreview } from './PackagePreview';
import { ProDossier } from '../dossier/ProDossier';
import { ReviewForm } from './ReviewForm';
import { ClarificationPanel } from './ClarificationPanel';
import { PackageDownloadCard } from './PackageDownloadCard';
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
  answerClarification,
  approveReview,
  exportZip,
}: Props) {
  const t = (ru: string, kk: string) => (lang === 'ru' ? ru : kk);
  return (
    <section>
      <div className="workspace-heading">
        <div>
          <h2>{t('Отчёт и документы', 'Есеп және құжаттар')}</h2>
          <p>
            {t(
              'Скачайте отчёт с выводами, источниками и снимками. Для официального обращения сначала проверьте находки и заполните сведения ответственного сотрудника.',
              'Қорытындылар, дереккөздер және суреттер бар есепті жүктеңіз. Ресми өтініш үшін белгілерді тексеріп, жауапты қызметкердің мәліметтерін толтырыңыз.',
            )}
          </p>
        </div>
      </div>
      <div className="package-layout">
        <div>
          <PackagePreview c={current} lang={lang} templates={templates} onChange={setCurrent} />
          <details className="technical-details">
            <summary>{t('Подготовить официальное обращение', 'Ресми өтініш дайындау')}</summary>
            {current.analysisLevel === 'pro' && (
              <LegalReviewForm
                key={'legal:' + current.id + ':' + (current.revisions?.length || 0)}
                c={current}
                lang={lang}
                onChange={setCurrent}
              />
            )}
            <ProDossier
              c={current}
              lang={lang}
              onReview={() => document.querySelector('.review-form')?.scrollIntoView()}
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
          </details>
        </div>
        <aside>
          <PackageDownloadCard current={current} lang={lang} busy={busy} exportZip={exportZip} />
        </aside>
      </div>
    </section>
  );
}
