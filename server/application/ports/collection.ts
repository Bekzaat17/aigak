import type { CaseRecord, Evidence, Localized } from '../../../shared/types';
export interface CollectedArtifacts {
  artifacts: { evidence: Evidence; bytes: Buffer }[];
  links: string[];
  redirects: CaseRecord['redirects'];
  issues: Localized[];
  errorCode?: string;
  agentActions?: import('../../../shared/agent-run').AgentAction[];
}
export interface CollectionStrategy {
  readonly id: string;
  readonly timeoutMs: number;
  run(snapshot: Readonly<CaseRecord>, signal: AbortSignal): Promise<CollectedArtifacts>;
}
export interface CollectionWave {
  readonly strategies: readonly CollectionStrategy[];
  readonly fallback: boolean;
}
export type ArtifactReviewer = (
  evidence: readonly Evidence[],
  errorCode?: string,
) => {
  status: 'adequate' | 'limited' | 'failed';
  textLength: number;
};
