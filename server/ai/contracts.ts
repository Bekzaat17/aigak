import type { AiAttempt } from '../../shared/types.ts';

export type AiTask = 'context' | 'mechanics' | 'verification' | 'legal' | 'pro_review';
export interface ModelProfile {
  adapter: 'responses' | 'chat-completions';
  baseUrl: string;
  apiKeyEnv: string;
  model: string;
  timeoutMs: number;
  maxOutputTokens: number;
  retries: number;
  temperature?: number;
  reasoningEffort?: 'none' | 'minimal' | 'low' | 'medium' | 'high' | 'xhigh' | 'max';
}
export interface AiConfiguration {
  profiles: Record<string, ModelProfile>;
  routes: Record<AiTask, string[]>;
}
export interface ModelRequest {
  instructions: string;
  input: string;
  schema: Record<string, unknown>;
  schemaName: string;
}
export interface ModelResponse {
  text: string;
  actualModel?: string;
  inputTokens?: number;
  outputTokens?: number;
}
export interface ModelAdapter {
  complete(
    profile: ModelProfile,
    key: string,
    request: ModelRequest,
    signal: AbortSignal,
  ): Promise<ModelResponse>;
}
export interface AttemptObserver {
  beforeAttempt(): void;
  onAttempt(attempt: AiAttempt): void;
}
export { AiError } from './AiError.ts';

export interface ModelGateway {
  readonly available: boolean;
  complete<T>(
    task: AiTask,
    request: ModelRequest,
    versions: { promptVersion: string; schemaVersion: string },
    signal: AbortSignal,
    observer: AttemptObserver,
    validate: (text: string) => T,
  ): Promise<T>;
}
