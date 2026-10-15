import type { CaseRecord } from '../../../shared/types';
import { assertGroundedFinding } from '../../domain/assert-grounded-finding';
import { verifiedFindingScreenshot } from '../../../shared/finding-screenshot';

/** Review owns acceptance and bounded repair, never the collectors' or analysts' conclusions. */
export class EvidenceSupervisor {
  constructor(
    private readonly strategies: readonly {
      id: string;
      verify(record: CaseRecord, signal?: AbortSignal): Promise<void>;
    }[],
  ) {}
  async verify(record: CaseRecord, signal?: AbortSignal) {
    for (const strategy of this.strategies) {
      if (
        signal?.aborted ||
        !record.findings.some((f) => !verifiedFindingScreenshot(f, record.evidence))
      )
        break;
      const start = Date.now();
      await strategy.verify(
        record,
        AbortSignal.any([AbortSignal.timeout(20000), ...(signal ? [signal] : [])]),
      );
      const missing = record.findings.filter(
        (f) => !verifiedFindingScreenshot(f, record.evidence),
      ).length;
      record.scenarioRun?.actions.push({
        role: 'evidence-supervisor',
        action: strategy.id,
        status: missing ? 'rejected' : 'completed',
        reason: missing ? 'VISUAL_PROOF_INCOMPLETE' : 'PROOF_CONFIRMED',
        startedAt: new Date(start).toISOString(),
        durationMs: Date.now() - start,
      });
    }
    const accepted = [];
    for (const finding of record.findings) {
      try {
        assertGroundedFinding(finding, record.evidence);
        accepted.push(finding);
      } catch {
        record.issues.push({
          ru: 'Вывод исключён: точная цитата не подтверждена сохранённым материалом.',
          kk: 'Қорытынды алынып тасталды: дәйексөз сақталған материалмен расталмады.',
        });
      }
    }
    if (accepted.length !== record.findings.length) record.likelihood = null;
    record.findings = accepted;
    if (
      record.scenarioRun &&
      (record.collection?.status !== 'adequate' ||
        record.findings.some((f) => !verifiedFindingScreenshot(f, record.evidence)) ||
        record.inspection?.status !== 'completed')
    )
      record.scenarioRun.status = 'partial';
  }
}
