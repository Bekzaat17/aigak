import type { Evidence, Finding } from './types.ts';

export function verifiedFindingScreenshot(finding: Finding, evidence: Evidence[]) {
  if (finding.visualEvidence?.status !== 'verified') return undefined;
  const id = finding.visualEvidence.screenshotId;
  return evidence.find(
    (e) =>
      e.id === id &&
      e.mime === 'image/png' &&
      e.method === 'finding-screenshot' &&
      e.capture?.textEvidenceId === finding.evidenceId &&
      e.capture.visibleText === finding.quote &&
      e.capture.quality === 'adequate',
  );
}
