import {
  AlertCircle,
  ArrowLeft,
  Check,
  ChevronDown,
  Download,
  FolderArchive,
  Loader2,
  MessageSquareText,
} from 'lucide-react';
import { levelName } from '../../shared/inspection';
import { reviewLabels } from '../../shared/inspection-presentation';
import type { CaseRecord } from '../../shared/types';
import { AnalysisProgress } from '../AnalysisProgress';
import {
  FindingsWorkspace,
  LawWorkspace,
  MaterialsWorkspace,
  ResultSummary,
} from '../CaseWorkspace';
import { OsintPanel } from '../OsintPanel';
import { PackagePreview } from '../PackagePreview';
import { LegalReviewForm, ProDossier } from '../ProDossier';
import { ReviewCycle } from '../ReviewCycle';
import { primaryMaterials } from '../case-view';
import { Question } from '../features/review/Question.tsx';
import { ReviewForm } from '../features/review/ReviewForm.tsx';
import { auditLabel } from '../i18n/audit-label.ts';
import { date } from '../lib/format.ts';
import type { AppController } from './useAppController.ts';
type Props = Pick<
  AppController,
  | 'lang'
  | 't'
  | 'current'
  | 'setCurrent'
  | 'busy'
  | 'analysisLevel'
  | 'templates'
  | 'tab'
  | 'setTab'
  | 'run'
  | 'saveFinding'
  | 'answerClarification'
  | 'approveReview'
  | 'processing'
  | 'openTab'
  | 'reset'
  | 'exportZip'
> & { current: CaseRecord };
export function CaseScreen({
  lang,
  t,
  current,
  setCurrent,
  busy,
  templates,
  tab,
  setTab,
  run,
  saveFinding,
  answerClarification,
  approveReview,
  processing,
  openTab,
  reset,
  exportZip,
}: Props) {
  return (
    <section className="results">
      <div className="result-nav">
        <button className="text-button" onClick={reset}>
          <ArrowLeft size={16} />
          {t('Новый анализ', 'Жаңа талдау')}
        </button>
        <span className="mono">{current.number}</span>
      </div>
      <div className="result-heading">
        <div>
          <div className="eyebrow">{t('РЕЗУЛЬТАТ ПРОВЕРКИ', 'ТЕКСЕРУ НӘТИЖЕСІ')}</div>
          <h1>{current.title}</h1>
          <p>
            {date(current.createdAt, lang)} · {t('Время Алматы', 'Алматы уақыты')}{' '}
            {current.demo && (
              <span className="demo-badge">{t('Учебный пример', 'Оқу мысалы')}</span>
            )}
          </p>
        </div>
        <button
          className="primary"
          disabled={busy || !!processing || !current.evidence.length}
          onClick={() => void exportZip()}
        >
          {busy ? <Loader2 size={18} className="spin" /> : <Download size={18} />}{' '}
          {t('Скачать проект пакета', 'Пакет жобасын жүктеу')}
        </button>
      </div>
      {processing ? (
        <AnalysisProgress c={current} lang={lang} />
      ) : (
        <>
          <ResultSummary
            c={current}
            lang={lang}
            onReview={() => {
              if (current.findings.some((f) => f.decision === 'pending')) {
                setTab('analysis');
                setTimeout(
                  () =>
                    document
                      .getElementById('findings-workspace')
                      ?.scrollIntoView({ behavior: 'smooth', block: 'start' }),
                  50,
                );
              } else openTab('package');
            }}
          />
          {current.analysisLevel === 'pro' && (
            <ProDossier c={current} lang={lang} onReview={() => openTab('package')} />
          )}
          <div id="result-sections" />
          <div className="result-tabs" aria-label={t('Разделы проверки', 'Тексеру бөлімдері')}>
            {(
              [
                {
                  id: 'analysis',
                  label: t('Выводы', 'Қорытындылар'),
                  count: current.findings.length,
                },
                {
                  id: 'evidence',
                  label: t('Материалы', 'Материалдар'),
                  count: primaryMaterials(current).length,
                },
                { id: 'osint', label: t('О ресурсе', 'Ресурс туралы') },
                { id: 'law', label: t('Закон', 'Заң') },
                { id: 'package', label: t('Проверка и пакет', 'Тексеру және пакет') },
              ] as const
            ).map((x) => (
              <button
                key={x.id}
                aria-pressed={tab === x.id}
                className={tab === x.id ? 'active' : ''}
                onClick={() => openTab(x.id)}
              >
                {x.label}
                {'count' in x && <span>{x.count}</span>}
              </button>
            ))}
          </div>
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
                <PackagePreview
                  c={current}
                  lang={lang}
                  templates={templates}
                  onChange={setCurrent}
                />
                <ReviewCycle
                  key={current.id + ':' + (current.revisions?.length || 0)}
                  c={current}
                  lang={lang}
                  busy={busy}
                  update={setCurrent}
                  run={run}
                />
                <section className="panel">
                  <div className="section-line">
                    <h3>
                      <MessageSquareText size={20} />
                      {t('Уточним перед завершением', 'Аяқтамас бұрын нақтылайық')}
                    </h3>
                    <span>{t('2 вопроса', '2 сұрақ')}</span>
                  </div>
                  <p className="muted">
                    {t(
                      'Ответы — оценка инспектора. Они не заменяют первичные материалы.',
                      'Жауаптар — инспектор бағасы. Олар бастапқы материалдарды алмастырмайды.',
                    )}
                  </p>
                  {current.clarifications.map((q) => (
                    <Question
                      key={q.id}
                      q={q}
                      lang={lang}
                      busy={busy}
                      save={(answer, note) => answerClarification(q.id, answer, note)}
                    />
                  ))}
                </section>
                <ReviewForm
                  key={current.id}
                  current={current}
                  lang={lang}
                  busy={busy}
                  save={approveReview}
                />
              </div>
              <aside>
                <div className="aside-card package-card">
                  <FolderArchive size={28} />
                  <h3>{t('Всё в одном архиве', 'Барлығы бір мұрағатта')}</h3>
                  <ul>
                    {[
                      t('DOCX по выбранному шаблону', 'Таңдалған үлгі бойынша DOCX'),
                      t('Отчёты RU / KK в PDF и HTML', 'PDF және HTML есептері RU / KK'),
                      t('Оригиналы и извлечённый текст', 'Түпнұсқалар және алынған мәтін'),
                      t('Опись SHA-256 и журнал', 'SHA-256 тізімдемесі және журнал'),
                    ].map((s) => (
                      <li key={s}>
                        <Check size={16} />
                        {s}
                      </li>
                    ))}
                  </ul>
                  <div className="package-status">
                    <span className="live-dot" />
                    {current.status === 'verified'
                      ? t('Проверено · проект документа', 'Тексерілген · құжат жобасы')
                      : t('Проект · требуется проверка', 'Жоба · тексеру қажет')}
                  </div>
                  <button
                    className="primary"
                    disabled={busy || !current.evidence.length}
                    onClick={() => void exportZip()}
                  >
                    <Download size={17} />
                    {t('Скачать ZIP', 'ZIP жүктеу')}
                  </button>
                  <small>
                    {t(
                      'Можно скачать проект до завершения проверки. Официальная форма требует согласования.',
                      'Тексеру аяқталмай тұрып жобаны жүктеуге болады. Ресми нысан келісуді қажет етеді.',
                    )}
                  </small>
                </div>
              </aside>
            </div>
          )}
          <details className="technical-details">
            <summary>
              {t(
                'Как проводился анализ · этапы и журнал',
                'Талдау қалай жүргізілді · кезеңдер мен журнал',
              )}
            </summary>
            {current.inspection && (
              <details className="inspection-trace panel">
                <summary>
                  {levelName(current.analysisLevel)[lang]} ·{' '}
                  {current.inspection.status === 'partial'
                    ? t('Частичная проверка', 'Ішінара тексеру')
                    : t('Проверки завершены', 'Тексерулер аяқталды')}
                </summary>
                <p className="muted">
                  {t('Этапов ИИ', 'AI кезеңдері')}: {current.inspection.aiCalls}
                </p>
                {current.inspection.stages.map((stage) => (
                  <article key={stage.id}>
                    <strong>{stage.name[lang]}</strong>
                    <small>
                      {stage.status === 'completed'
                        ? t('Выполнено', 'Орындалды')
                        : stage.status === 'partial'
                          ? t('Частично', 'Ішінара')
                          : stage.status === 'skipped'
                            ? t('Пропущено', 'Өткізілді')
                            : t('Ошибка', 'Қате')}{' '}
                      · v{stage.version} · {(stage.durationMs / 1000).toFixed(1)} s
                    </small>
                    <p>{stage.summary[lang]}</p>
                    {stage.aiAttempts?.map((a, i) => (
                      <p className="muted" key={i}>
                        {a.profile} · {a.actualModel || a.requestedModel} ·{' '}
                        {a.status === 'completed'
                          ? t('Ответ получен', 'Жауап алынды')
                          : t('Ошибка', 'Қате')}{' '}
                        · {(a.durationMs / 1000).toFixed(1)} s · {a.inputTokens ?? '—'} /{' '}
                        {a.outputTokens ?? '—'} tokens
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
                            <strong>
                              {t('Нужно уточнить у инспектора', 'Инспектордан нақтылау қажет')}
                            </strong>
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
                          · {h.normId}
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
                ))}
              </details>
            )}
            {
              <section className="panel">
                <h3>{t('История работы с материалами', 'Материалдармен жұмыс тарихы')}</h3>
                <p className="muted">
                  {t(
                    'Локальная цепочка событий с контрольными суммами. Без внешнего заверения времени.',
                    'Бақылау сомалары бар жергілікті оқиғалар тізбегі. Уақыт сырттай куәландырылмаған.',
                  )}
                </p>
                <div className="timeline">
                  {current.audit.map((a) => (
                    <div key={a.id}>
                      <span className="timeline-dot" />
                      <div>
                        <small>{date(a.at, lang)}</small>
                        <strong>{auditLabel(a.action, lang)}</strong>
                        <p>{a.detail}</p>
                        <code>{a.hash}</code>
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            }
          </details>
          {current.issues.length > 0 && (
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
          )}
        </>
      )}
    </section>
  );
}
