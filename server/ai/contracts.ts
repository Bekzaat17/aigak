import type { AiAttempt } from '../../shared/types.ts';

export type AiTask = 'context' | 'mechanics' | 'verification' | 'legal' | 'pro_review';
export interface ModelProfile {
  adapter:'responses'|'chat-completions';
  baseUrl:string;
  apiKeyEnv:string;
  model:string;
  timeoutMs:number;
  maxOutputTokens:number;
  retries:number;
  temperature?:number;
}
export interface AiConfiguration {
  profiles:Record<string,ModelProfile>;
  routes:Record<AiTask,string[]>;
}
export interface ModelRequest {
  instructions:string;
  input:string;
  schema:Record<string,unknown>;
  schemaName:string;
}
export interface ModelResponse {
  text:string;
  actualModel?:string;
  inputTokens?:number;
  outputTokens?:number;
}
export interface ModelAdapter {
  complete(profile:ModelProfile,key:string,request:ModelRequest,signal:AbortSignal):Promise<ModelResponse>;
}
export interface AttemptObserver {
  beforeAttempt():void;
  onAttempt(attempt:AiAttempt):void;
}
export class AiError extends Error {
  constructor(readonly code:string,readonly retryable=false){super(code);}
}
