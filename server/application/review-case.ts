import { buildDossier } from '../../shared/dossier.ts';
import type { CaseRecord, Decision } from '../../shared/types.ts';
import { busyStatuses } from '../../shared/types.ts';
import type { CaseStore } from './ports/storage.ts';

export async function reviewFinding(
  store: Pick<CaseStore, 'event' | 'verify'>,
  c: CaseRecord,
  id: string,
  decision: Decision,
  note = '',
) {
  if (busyStatuses.includes(c.status)) throw new Error('CASE_BUSY');
  const f = c.findings.find((f) => f.id === id);
  if (!f) throw new Error('NOT_FOUND');
  f.decision = decision;
  f.note = note;
  c.status = 'review';
  delete c.reviewedAt;
  await store.event(c, 'finding.reviewed', `${f.id}: ${decision}; ${note}`);
}

export async function approveCase(
  store: Pick<CaseStore, 'event' | 'verify'>,
  c: CaseRecord,
  officer: string,
  notes: string,
) {
  if (busyStatuses.includes(c.status)) throw new Error('CASE_BUSY');
  if (
    !officer.trim() ||
    !c.findings.length ||
    c.findings.some((f) => f.decision === 'pending') ||
    !c.findings.some((f) => f.decision === 'accepted') ||
    !notes.trim() ||
    c.clarifications.some((q) => q.answer !== 'yes')
  )
    throw new Error('REVIEW_INCOMPLETE');
  if (
    c.materialsPending ||
    c.followUps?.some((q) => !q.answer.trim()) ||
    (c.analysisLevel === 'pro' && !buildDossier(c).ready)
  )
    throw new Error('REVIEW_INCOMPLETE');
  store.verify(c);
  c.officer = officer.trim();
  c.notes = notes.trim();
  c.reviewedAt = new Date().toISOString();
  c.status = 'verified';
  await store.event(c, 'case.reviewed', `${c.officer}: ${c.notes}`);
}
