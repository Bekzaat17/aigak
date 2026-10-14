import type { CaseRecord, Decision, Finding, Lang } from '../../../shared/types';
export type CaseTab = 'analysis' | 'osint' | 'evidence' | 'law' | 'package';
export interface CaseScreenProps {
  lang: Lang;
  current: CaseRecord;
  setCurrent: (record: CaseRecord) => void;
  busy: boolean;
  templates: { id: string; name: string }[];
  tab: CaseTab;
  run: (action: () => Promise<void>) => Promise<void>;
  saveFinding: (finding: Finding, decision: Decision, note: string) => void;
  answerClarification: (questionId: string, answer: string, note: string) => void;
  approveReview: (officer: string, notes: string) => void;
  processing: boolean | null;
  openTab: (tab: CaseTab) => void;
  reviewFindings: () => void;
  reset: () => void;
  exportZip: () => Promise<void>;
}
