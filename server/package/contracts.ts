import type { OsintReport } from '../../shared/osint.ts';
import type {
  AnalysisLevel,
  AuditEvent,
  Evidence,
  Finding,
  InspectionRun,
  Lang,
  Localized,
} from '../../shared/types.ts';

/** Versioned hand-off from any analysis workflow. No queue, storage or AI dependency. */
export interface PackageDocument {
  scenarioRun?: import('../../shared/agent-run').ScenarioRun;
  materialsPending?: boolean;
  legalReview?: import('../../shared/types.ts').CaseRecord['legalReview'];
  previewImages?: Record<string, string>;
  followUps?: import('../../shared/types.ts').FollowUp[];
  revisions?: import('../../shared/types.ts').CaseRevision[];
  schemaVersion: 'aigak-package-input/1';
  id: string;
  number: string;
  title: string;
  sourceUrl?: string;
  createdAt: string;
  status: 'draft' | 'verified';
  demo: boolean;
  officer: string;
  notes: string;
  analysisLevel: AnalysisLevel;
  engine: 'rules' | 'ai';
  assessment: Localized;
  likelihood: number | null;
  evidence: Evidence[];
  findings: Finding[];
  issues: Localized[];
  inspection?: InspectionRun;
  osint?: OsintReport;
  audit: AuditEvent[];
  clarifications: {
    id: string;
    question: Localized;
    answer: 'yes' | 'no' | 'unknown' | '';
    note: string;
  }[];
  links: string[];
  redirects: { url: string; status: number }[];
}
export interface PackageInput {
  document: PackageDocument;
  evidenceFiles: { id: string; bytes: Buffer }[];
  templates: Record<Lang, Buffer>;
  layoutId?: string;
  includePdf?: boolean;
}
export interface PackageFile {
  path: string;
  bytes: Buffer;
}
export interface PackageResult {
  bytes: Buffer;
  warnings: string[];
  files: { path: string; sha256: string; size: number }[];
}
export interface ReportLayout {
  readonly id: string;
  html(document: PackageDocument, lang: Lang): string;
  fields(document: PackageDocument, lang: Lang): Record<string, string>;
}
export interface DocumentRenderer {
  render(template: Buffer, fields: Record<string, string>): Buffer;
}
export interface PdfRenderer {
  render(reports: { lang: Lang; html: string }[]): Promise<PackageFile[]>;
}
export interface ArchiveWriter {
  build(files: PackageFile[]): Promise<Buffer>;
}
