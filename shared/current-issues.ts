import type { CaseRecord } from './types.ts';

/** Old run failures remain in revision snapshots, not in a now-successful stage's warnings. */
export function currentIssues(c: Pick<CaseRecord, 'issues' | 'inspection' | 'findings'>) {
  const completed = c.inspection?.stages.filter((s) => s.status === 'completed') || [];
  const visuallyVerified =
    c.findings.length > 0 && c.findings.every((f) => f.visualEvidence?.status === 'verified');
  return c.issues.filter(
    (issue) =>
      !completed.some((stage) => issue.ru.startsWith(stage.name.ru + ': ')) &&
      !(visuallyVerified && issue.ru.startsWith('Визуальное подтверждение:')),
  );
}
