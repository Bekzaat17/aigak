import type { AiTask } from '../contracts.ts';
import { context } from './context.ts';
import { legal } from './legal.ts';
import { mechanics } from './mechanics.ts';
import { pro_review } from './pro_review.ts';
import { verification } from './verification.ts';
export const PROMPT_VERSION = 'advanced/1.2.0';
export const prompts: Record<AiTask, string> = {
  legal,
  pro_review,
  context,
  mechanics,
  verification,
};
