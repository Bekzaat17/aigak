export interface AgentAction {
  role: string;
  action: string;
  status: 'completed' | 'failed' | 'rejected';
  startedAt: string;
  durationMs: number;
  reason?: string;
  model?: string;
  promptVersion?: string;
  inputTokens?: number;
  outputTokens?: number;
  costUsd?: number | null;
}
export interface ScenarioRun {
  version: '1.0.0';
  startedAt: string;
  deadlineAt: string;
  completedAt?: string;
  status: 'running' | 'completed' | 'partial';
  actions: AgentAction[];
}
