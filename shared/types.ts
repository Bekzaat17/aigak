export type AnalysisLevel = 'basic' | 'advanced' | 'pro';
export interface InspectionStage {
  id: string; version: string; name: Localized; status: 'completed' | 'skipped' | 'failed';
  startedAt: string; durationMs: number; summary: Localized; findingIds: string[]; observations: Finding[]; errorCode?: string;
}
export interface InspectionRun {
  level: AnalysisLevel; version: string; status: 'completed' | 'partial';
  startedAt: string; completedAt: string; aiCalls: number; stages: InspectionStage[];
}
export type Lang = 'ru' | 'kk';
export type Localized = { ru: string; kk: string };
export type Status = 'queued' | 'collecting' | 'analyzing' | 'review' | 'verified' | 'failed';
export type Decision = 'pending' | 'accepted' | 'rejected';
export interface Evidence {
  id: string; name: string; storedName: string; mime: string; size: number; sha256: string;
  createdAt: string; kind: 'original' | 'snapshot' | 'text' | 'metadata';
  parentId?: string; text?: string; method: string;
}
export interface Finding {
  id: string; category: string; title: Localized; explanation: Localized;
  evidenceId: string; quote: string; start: number; end: number;
  rule?: {
    id:string; version:string; kind:'term'|'combination';
    matches:{termId:string;start:number;end:number;text:string}[];
    contexts:{id:string;title:Localized;question:Localized;quote:string;start:number;end:number}[];
  };
  agentIds?: string[]; engine: 'rules' | 'ai'; decision: Decision; note?: string;
}
export interface AuditEvent { id: string; at: string; action: string; detail: string; previousHash: string; hash: string }
export interface CaseRecord {
  id: string; number: string; title: string; sourceType: 'url' | 'file' | 'text'; sourceUrl?: string;
  createdAt: string; updatedAt: string; completedAt?: string; status: Status; step: Localized;
  analysisLevel: AnalysisLevel; inspection?: InspectionRun;
  demo: boolean; useAi: boolean; engine: 'rules' | 'ai'; evidence: Evidence[]; findings: Finding[];
  issues: Localized[]; links: string[]; redirects: { url: string; status: number }[];
  officer: string; notes: string; reviewedAt?: string; audit: AuditEvent[];
  likelihood: number | null; assessment: Localized; templateId: string;
  clarifications: {id:string;question:Localized;answer:'yes'|'no'|'unknown'|'';note:string}[];
}
export type CaseSummary = Omit<CaseRecord, 'evidence' | 'findings' | 'audit'> & { evidenceCount: number; findingCount: number; acceptedCount: number };
export const busyStatuses: Status[] = ['queued', 'collecting', 'analyzing'];
