import type {AiAnalyzer} from './contracts.ts';
import {AiGateway} from '../ai/gateway.ts';
import {loadAiConfig} from '../ai/config.ts';
import {ResponsesAdapter,ChatCompletionsAdapter} from '../ai/adapters.ts';
import {prompts,PROMPT_VERSION} from '../ai/prompts.ts';
import {outputSchema,parseAnalysis,SCHEMA_VERSION} from '../ai/schema.ts';
import {AiError} from '../ai/contracts.ts';

/** Domain adapter: translates inspection data to a provider-independent gateway request. */
export class GatewayAnalyzer implements AiAnalyzer {
  constructor(private readonly gateway:AiGateway){}
  get available(){return this.gateway.available;}
  async analyze(evidence:Parameters<AiAnalyzer['analyze']>[0],options:Parameters<AiAnalyzer['analyze']>[1]){
    const task=options.task;
    const sources=evidence.filter(e=>e.text?.trim());
    const input=JSON.stringify({
      sources:sources.map(e=>({id:e.id,text:e.text})),
      candidates:options.candidates||[],
      previousStages:(options.previousStages||[]).map(s=>({id:s.id,status:s.status,summary:s.summary,observations:s.observations,review:s.review})),
    });
    // Fail visibly rather than silently inspecting a truncated source.
    if(input.length>180000)throw new AiError('AI_INPUT_TOO_LARGE');
    return this.gateway.complete(task,{instructions:prompts[task],input,schema:outputSchema,schemaName:'inspection_v2'},
      {promptVersion:PROMPT_VERSION,schemaVersion:SCHEMA_VERSION},options.signal,
      {beforeAttempt:options.beforeAttempt||(()=>{}),onAttempt:options.onAttempt||(()=>{})},
      text=>parseAnalysis(text,sources));
  }
}
export function createAiAnalyzer(){
  return new GatewayAnalyzer(new AiGateway(loadAiConfig(),{responses:new ResponsesAdapter(),'chat-completions':new ChatCompletionsAdapter()}));
}
