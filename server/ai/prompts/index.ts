import { agentRolePrompt } from './agent-roles';
import type { AiTask } from '../contracts.ts';
import { context } from './context.ts';
import { legal } from './legal.ts';
import { mechanics } from './mechanics.ts';
import { pro_review } from './pro_review.ts';
import { verification } from './verification.ts';
import { sourceFormat } from './source-format.ts';
export const PROMPT_VERSION = 'advanced/1.7.0';
export const prompts: Record<AiTask, string> = {
  legal: agentRolePrompt('legal') + legal + sourceFormat,
  pro_review: agentRolePrompt('pro_review') + pro_review + sourceFormat,
  context: agentRolePrompt('context') + context + sourceFormat,
  mechanics: agentRolePrompt('mechanics') + mechanics + sourceFormat,
  verification: agentRolePrompt('verification') + verification + sourceFormat,
};
