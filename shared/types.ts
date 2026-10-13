import type { OsintReport } from './osint.ts';
export interface AiAttempt {
  profile: string;
  adapter: string;
  requestedModel: string;
  actualModel?: string;
  promptVersion: string;
  schemaVersion: string;
  startedAt: string;
  durationMs: number;
  status: 'completed' | 'failed';
  errorCode?: string;
  inputTokens?: number;
  outputTokens?: number;
}
export interface LegalHypothesis {
  normId: string;
  normQuote: string;
  findingIds: string[];
  reason: Localized;
  missing: Localized[];
}
export interface AiReview {
  status: 'indicators' | 'ambiguous' | 'insufficient' | 'not_found';
  uncertainties: Localized[];
  questions: Localized[];
  contradictions: { evidenceId: string; quote: string; explanation: Localized }[];
}
export type AnalysisLevel = 'basic' | 'advanced' | 'pro';
export interface InspectionStage {
  id: string;
  version: string;
  name: Localized;
  status: 'completed' | 'partial' | 'skipped' | 'failed';
  startedAt: string;
  durationMs: number;
  summary: Localized;
  findingIds: string[];
  observations: Finding[];
  errorCode?: string;
  aiAttempts?: AiAttempt[];
  review?: AiReview;
  legalHypotheses?: LegalHypothesis[];
}
export interface InspectionRun {
  level: AnalysisLevel;
  version: string;
  status: 'completed' | 'partial';
  startedAt: string;
  completedAt: string;
  aiCalls: number;
  aiAttempts?: number;
  stages: InspectionStage[];
}
export type Lang = 'ru' | 'kk';
export type Localized = { ru: string; kk: string };
export type Status = 'queued' | 'collecting' | 'analyzing' | 'review' | 'verified' | 'failed';
export type Decision = 'pending' | 'accepted' | 'rejected';
export interface Evidence {
  id: string;
  name: string;
  storedName: string;
  mime: string;
  size: number;
  sha256: string;
  createdAt: string;
  kind: 'original' | 'snapshot' | 'text' | 'metadata';
  parentId?: string;
  text?: string;
  method: string;
  sourceUrl?: string;
}
export interface Finding {
  scope?: 'target' | 'related';
  region?: {
    evidenceId: string;
    x: number;
    y: number;
    width: number;
    height: number;
    author: 'inspector';
  };
  id: string;
  category: string;
  title: Localized;
  explanation: Localized;
  evidenceId: string;
  quote: string;
  start: number;
  end: number;
  rule?: {
    id: string;
    version: string;
    kind: 'term' | 'combination';
    matches: { termId: string; start: number; end: number; text: string }[];
    contexts: {
      id: string;
      title: Localized;
      question: Localized;
      quote: string;
      start: number;
      end: number;
    }[];
  };
  agentIds?: string[];
  engine: 'rules' | 'ai';
  decision: Decision;
  note?: string;
}
export interface AuditEvent {
  id: string;
  at: string;
  action: string;
  detail: string;
  previousHash: string;
  hash: string;
}
export interface FollowUp {
  id: string;
  question: Localized;
  answer: string;
  evidenceIds: string[];
}
export interface CaseRevision {
  sha256?: string;
  legalReview?: CaseRecord['legalReview'];
  number: number;
  savedAt: string;
  analysisLevel: AnalysisLevel;
  status: Status;
  findings: Finding[];
  inspection?: InspectionRun;
  osint?: OsintReport;
  assessment: Localized;
  likelihood: number | null;
  issues: Localized[];
  followUps: FollowUp[];
  clarifications: CaseRecord['clarifications'];
  evidenceIds: string[];
  officer: string;
  notes: string;
  reviewedAt?: string;
}
export interface CaseRecord {
  legalReview?: {
    eventDate: string;
    jurisdictionConfirmed: boolean;
    editionConfirmed: boolean;
    officer: string;
    note: string;
  };
  materialsPending?: boolean;
  followUps?: FollowUp[];
  revisions?: CaseRevision[];
  reanalysis?: boolean;

  id: string;
  number: string;
  title: string;
  sourceType: 'url' | 'file' | 'text';
  sourceUrl?: string;
  createdAt: string;
  updatedAt: string;
  completedAt?: string;
  status: Status;
  step: Localized;
  analysisLevel: AnalysisLevel;
  inspection?: InspectionRun;
  osint?: OsintReport;
  demo: boolean;
  useAi: boolean;
  engine: 'rules' | 'ai';
  evidence: Evidence[];
  findings: Finding[];
  issues: Localized[];
  links: string[];
  redirects: { url: string; status: number }[];
  officer: string;
  notes: string;
  reviewedAt?: string;
  audit: AuditEvent[];
  likelihood: number | null;
  assessment: Localized;
  templateId: string;
  clarifications: {
    id: string;
    question: Localized;
    answer: 'yes' | 'no' | 'unknown' | '';
    note: string;
  }[];
}
export type CaseSummary = Omit<CaseRecord, 'evidence' | 'findings' | 'audit'> & {
  evidenceCount: number;
  findingCount: number;
  acceptedCount: number;
};
export const busyStatuses: Status[] = ['queued', 'collecting', 'analyzing'];
