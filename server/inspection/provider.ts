import { analyzeAi } from '../analysis.ts';
import type { AiAnalyzer } from './contracts.ts';

/** Adapter: only this class knows the concrete model integration. */
export class OpenAiAnalyzer implements AiAnalyzer {
  get available(){return !!process.env.OPENAI_API_KEY;}
  analyze(...args:Parameters<AiAnalyzer['analyze']>){return analyzeAi(...args);}
}
