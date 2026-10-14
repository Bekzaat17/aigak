import { verifiedFindingScreenshot } from '../../shared/finding-screenshot.ts';
import { assertGroundedFinding } from '../domain/assert-grounded-finding.ts';
import type { PackageInput } from './contracts.ts';
import { sha256 as hash } from '../domain/sha256.ts';

export function validatePackageEvidence(
  c: PackageInput['document'],
  evidence: ReadonlyMap<string, Buffer>,
  evidenceFileCount: number,
): void {
  if (
    evidence.size !== evidenceFileCount ||
    evidence.size !== c.evidence.length ||
    new Set(c.evidence.map((e) => e.id)).size !== c.evidence.length
  )
    throw new Error('INVALID_EVIDENCE_LIST');
  for (const e of c.evidence) {
    const bytes = evidence.get(e.id);
    if (!bytes || bytes.length !== e.size || hash(bytes) !== e.sha256)
      throw new Error('INTEGRITY_FAILED');
  }
  for (const finding of c.findings) assertGroundedFinding(finding, c.evidence);
  for (const finding of c.findings)
    if (
      finding.visualEvidence?.status === 'verified' &&
      !verifiedFindingScreenshot(finding, c.evidence)
    )
      throw new Error('SCREENSHOT_PROVENANCE_MISSING');
  if (c.osint) {
    const references = [
      ...(c.osint.legalNorms || []).map((n) => n.evidenceId),
      ...(c.osint.registry ? [c.osint.registry.evidenceId] : []),
      ...c.osint.observations.map((o) => o.evidenceId),
      ...c.osint.stages.flatMap((s) => s.evidenceIds),
      ...(c.osint.relations || []).flatMap((r) => r.evidenceIds),
      ...(c.osint.candidates || []).flatMap((candidate) => candidate.evidenceIds),
    ];
    if (references.some((id) => !evidence.has(id))) throw new Error('OSINT_PROVENANCE_MISSING');
  }
  for (const stage of c.inspection?.stages || [])
    for (const h of stage.legalHypotheses || []) {
      const allFindings = [
        ...c.findings,
        ...(c.inspection?.stages || []).flatMap((s) => s.observations),
      ];
      if (
        !c.osint?.legalNorms?.some((n) => n.id === h.normId && n.quote.includes(h.normQuote)) ||
        h.findingIds.some((id) => !allFindings.some((f) => f.id === id))
      )
        throw new Error('UNGROUNDED_LEGAL_HYPOTHESIS');
    }
  for (const f of c.findings)
    if (f.region) {
      const r = f.region;
      if (
        !c.evidence.some((e) => e.id === r.evidenceId && e.mime.startsWith('image/')) ||
        ![r.x, r.y, r.width, r.height].every(Number.isFinite) ||
        r.x < 0 ||
        r.y < 0 ||
        r.width <= 0 ||
        r.height <= 0 ||
        r.x + r.width > 1.001 ||
        r.y + r.height > 1.001
      )
        throw Error('INVALID_REGION');
    }
}
