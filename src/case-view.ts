import { verifiedFindingScreenshot } from '../shared/finding-screenshot';
import { currentEvidence } from '../shared/current-evidence';
import { reliableContentAssessment } from '../shared/content-assessment';
import type { CaseRecord, Evidence, Finding } from '../shared/types';
/** Match preserved ancestry, not filenames or arbitrary image order. */
export function evidenceFamily(c: CaseRecord, id: string): Evidence[] {
  const source = c.evidence.find((e) => e.id === id);
  if (!source) return [];
  const ids = new Set<string>([id]);
  let parent = source.parentId;
  while (parent && !ids.has(parent)) {
    ids.add(parent);
    parent = c.evidence.find((e) => e.id === parent)?.parentId;
  }
  return c.evidence.filter((e) => ids.has(e.id));
}
export function findingImage(c: CaseRecord, f: Finding) {
  if (f.visualEvidence?.status === 'verified') return verifiedFindingScreenshot(f, c.evidence);
  if (f.visualEvidence?.status === 'unavailable') return undefined;
  const family = evidenceFamily(c, f.evidenceId);
  const normalize = (text: string) => text.replace(/\s+/gu, ' ').trim();
  const matched = c.evidence.find(
    (e) =>
      e.mime.startsWith('image/') &&
      e.capture?.quality === 'adequate' &&
      e.capture.textEvidenceId === f.evidenceId &&
      normalize(e.capture.visibleText).includes(normalize(f.quote)),
  );
  if (matched) return matched;
  const direct = family.find((e) => e.mime.startsWith('image/'));
  if (direct) return direct;
  // Legacy page screenshots have no verified quote mapping and must not be shown as proof.
  return undefined;
}
export function linkedHypotheses(c: CaseRecord, f: Finding) {
  const stages = c.inspection?.stages || [];
  const earlierIds = stages
    .flatMap((s) => s.observations)
    .filter((o) => o.evidenceId === f.evidenceId && o.quote === f.quote)
    .map((o) => o.id);
  return stages
    .flatMap((s) => s.legalHypotheses || [])
    .filter((h) => h.findingIds.some((id) => id === f.id || earlierIds.includes(id)));
}

export function contentVerdict(
  c: CaseRecord,
): 'confirmed' | 'indicators' | 'not_found' | 'insufficient' | 'rejected' {
  const targetFindings = c.findings.filter((f) => f.scope !== 'related');
  if (c.findings.length && !targetFindings.length) return 'insufficient';
  const final =
    c.inspection?.stages?.find((s) => s.id === 'pro_review' && s.status === 'completed') ||
    c.inspection?.stages?.find((s) => s.id === 'verification' && s.status === 'completed');
  if (c.status === 'verified' && c.findings.some((f) => f.decision === 'accepted'))
    return 'confirmed';
  if (c.status === 'failed' || !c.evidence.some((e) => e.text?.trim())) return 'insufficient';
  if (c.findings.length && c.findings.every((f) => f.decision === 'rejected')) return 'rejected';
  if (final?.review && ['insufficient', 'ambiguous'].includes(final.review.status))
    return 'insufficient';
  if (c.findings.length) return 'indicators';
  if (
    final?.review?.status === 'not_found' &&
    reliableContentAssessment(c.inspection?.stages || [], c.collection)
  )
    return 'not_found';
  if (c.collection && c.collection.status !== 'adequate') return 'insufficient';
  if (c.inspection?.status === 'partial') return 'insufficient';
  return 'not_found';
}

export function primaryMaterials(c: CaseRecord) {
  return currentEvidence(c).filter((e) => {
    if (e.mime.startsWith('image/'))
      return c.findings.some(
        (f) =>
          f.decision !== 'rejected' &&
          f.visualEvidence?.status === 'verified' &&
          verifiedFindingScreenshot(f, c.evidence)?.id === e.id,
      );
    return c.findings.some(
      (f) =>
        f.decision !== 'rejected' &&
        f.evidenceId === e.id &&
        !!f.quote.trim() &&
        !!e.text?.includes(f.quote),
    );
  });
}
export function materialFindings(c: CaseRecord, e: Evidence) {
  return c.findings.filter(
    (f) =>
      evidenceFamily(c, f.evidenceId).some((source) => source.id === e.id) ||
      findingImage(c, f)?.id === e.id,
  );
}
