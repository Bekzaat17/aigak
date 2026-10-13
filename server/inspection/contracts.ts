import type { AiTask } from '../ai/contracts.ts';
import type { AiAttempt, AiReview, AnalysisLevel, CaseRecord, Evidence, Finding, InspectionRun, InspectionStage, Localized } from '../../shared/types.ts';

export interface AiResult { findings: Finding[]; likelihood: number; assessment: Localized; review?:AiReview }
export interface AiAnalyzer {
  readonly available: boolean;
  analyze(evidence: Evidence[], options: {signal:AbortSignal;task:AiTask;candidates?:Finding[];previousStages?:InspectionStage[];beforeAttempt?:()=>void;onAttempt?:(attempt:AiAttempt)=>void}): Promise<AiResult>;
}
export interface CheckContext {
  readonly evidence: Evidence[];
  readonly findings: Finding[];
  readonly links: string[];
  readonly signal: AbortSignal;
  analyze(task:AiTask): Promise<AiResult>;
}
export interface CheckResult {
  status: 'completed' | 'skipped';
  summary: Localized;
  findings?: Finding[];
  /** Only an overall/context check may set the assessment; specialist scores are not averaged. */
  assessment?: Localized;
  likelihood?: number;
  replaceFindings?: boolean;
  review?:AiReview;
}
export interface InspectionCheck {
  readonly id: string;
  readonly version: string;
  readonly name: Localized;
  readonly requiresAi: boolean;
  execute(context: CheckContext): Promise<CheckResult>;
}
export interface InspectionStrategy {
  readonly level: AnalysisLevel;
  readonly checks: readonly string[];
  readonly maxAiCalls: number;
  readonly timeoutMs: number;
}
export interface InspectionResult {
  findings: Finding[]; assessment: Localized; likelihood: number|null;
  engine: 'rules'|'ai'; issues:Localized[]; run:InspectionRun;
}
export type InspectionInput = Pick<CaseRecord,'analysisLevel'|'evidence'|'links'>;
export type ProgressObserver = (stage:InspectionStage) => void;
