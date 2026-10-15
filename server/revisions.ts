import type { CaseRecord, Localized } from '../shared/types.ts';
import { busyStatuses } from '../shared/types.ts';
import type { CaseStore } from './application/ports/storage.ts';
import { sha256 } from './domain/sha256.ts';

/** Inspector statements remain separate from primary evidence. */
export function syncQuestions(c: CaseRecord) {
  const questions = (c.inspection?.stages || []).flatMap((s) => [
    ...(s.review?.questions || []),
    ...(s.legalHypotheses || []).flatMap((h) => h.missing),
  ]);
  const unique = new Map<string, Localized>();
  for (const q of questions) unique.set(sha256(q.ru + '\n' + q.kk).slice(0, 24), q);
  c.followUps = [...unique].map(([id, question]) => ({
    id,
    question,
    answer: '',
    evidenceIds: [],
  }));
}
export async function startRevision(
  store: CaseStore,
  c: CaseRecord,
  level: CaseRecord['analysisLevel'],
) {
  if (busyStatuses.includes(c.status)) throw Error('CASE_BUSY');
  store.verify(c);
  c.revisions ??= [];
  c.revisions.push(
    structuredClone({
      number: c.revisions.length + 1,
      savedAt: new Date().toISOString(),
      analysisLevel: c.analysisLevel,
      findings: c.findings,
      inspection: c.inspection,
      osint: c.osint,
      collection: c.collection,
      authentication: c.authentication,
      assessment: c.assessment,
      likelihood: c.likelihood,
      issues: c.issues,
      followUps: c.followUps || [],
      clarifications: c.clarifications,
      evidenceIds: c.evidence.map((e) => e.id),
      legalReview: c.legalReview,
      officer: c.officer,
      notes: c.notes,
      reviewedAt: c.reviewedAt,
      status: c.status,
    }),
  );
  const snapshot = c.revisions.at(-1)!;
  snapshot.sha256 = sha256(JSON.stringify(snapshot));
  c.analysisLevel = level;
  c.useAi = level !== 'basic';
  c.status = 'queued';
  c.step = {
    ru: 'Повторная проверка сохранённых материалов',
    kk: 'Сақталған материалдарды қайта тексеру',
  };
  c.reanalysis = true;
  delete c.reviewedAt;
  delete c.legalReview;
  await store.event(
    c,
    'revision.started',
    `version ${c.revisions.length + 1}; ${level}; previous snapshot ${snapshot.sha256}`,
  );
}
