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
  engine: 'rules' | 'ai'; decision: Decision; note?: string;
}
export interface AuditEvent { id: string; at: string; action: string; detail: string; previousHash: string; hash: string }
export interface CaseRecord {
  id: string; number: string; title: string; sourceType: 'url' | 'file' | 'text'; sourceUrl?: string;
  createdAt: string; updatedAt: string; completedAt?: string; status: Status; step: Localized;
  demo: boolean; useAi: boolean; engine: 'rules' | 'ai'; evidence: Evidence[]; findings: Finding[];
  issues: Localized[]; links: string[]; redirects: { url: string; status: number }[];
  officer: string; notes: string; reviewedAt?: string; audit: AuditEvent[];
  likelihood: number | null; assessment: Localized; templateId: string;
  clarifications: {id:string;question:Localized;answer:'yes'|'no'|'unknown'|'';note:string}[];
}
export type CaseSummary = Omit<CaseRecord, 'evidence' | 'findings' | 'audit'> & { evidenceCount: number; findingCount: number; acceptedCount: number };
export const busyStatuses: Status[] = ['queued', 'collecting', 'analyzing'];
