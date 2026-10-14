import type { Evidence, Finding } from '../../shared/types.ts';

export function assertGroundedFinding(finding: Finding, evidence: readonly Evidence[]): void {
  const source = evidence.find((item) => item.id === finding.evidenceId);
  if (
    !source?.text ||
    !finding.quote ||
    !Number.isInteger(finding.start) ||
    !Number.isInteger(finding.end) ||
    finding.start < 0 ||
    finding.end <= finding.start ||
    finding.end > source.text.length ||
    source.text.slice(finding.start, finding.end) !== finding.quote
  ) {
    throw new Error('UNGROUNDED_FINDING');
  }
}
