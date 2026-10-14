import { currentIssues } from '../shared/current-issues.ts';
import type { CaseRecord, Lang } from '../shared/types.ts';
import type { PackageDocument } from './package/contracts.ts';
import { reportHtml as renderHtml } from './package/html.ts';
export function packageDocument(c: CaseRecord): PackageDocument {
  return structuredClone({
    schemaVersion: 'aigak-package-input/1',
    id: c.id,
    number: c.number,
    title: c.title,
    sourceUrl: c.sourceUrl,
    createdAt: c.createdAt,
    status: c.status === 'verified' ? 'verified' : 'draft',
    demo: c.demo,
    officer: c.officer,
    notes: c.notes,
    analysisLevel: c.analysisLevel,
    engine: c.engine,
    assessment: c.assessment,
    likelihood: c.likelihood,
    evidence: c.evidence,
    findings: c.findings,
    issues: currentIssues(c),
    inspection: c.inspection,
    osint: c.osint,
    audit: c.audit,
    clarifications: c.clarifications,
    links: c.links,
    redirects: c.redirects,
    legalReview: c.legalReview,
    materialsPending: c.materialsPending,
    followUps: c.followUps,
    revisions: c.revisions,
  });
}
export function reportHtml(c: CaseRecord, lang: Lang) {
  return renderHtml(packageDocument(c), lang);
}
