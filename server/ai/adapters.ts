import {AiError,type ModelAdapter,type ModelProfile,type ModelRequest,type ModelResponse} from './contracts.ts';

export type HttpTransport = typeof fetch;
async function post(transport:HttpTransport,profile:ModelProfile,key:string,path:string,body:unknown,signal:AbortSignal){
  let response:Response;
  try {
    response=await transport(profile.baseUrl.replace(/\/$/,'')+path,{
      method:'POST',redirect:'error',signal,
      headers:{'Content-Type':'application/json',Authorization:'Bearer '+key},body:JSON.stringify(body),
    });
  } catch {
    if(signal.aborted)throw new AiError('AI_TIMEOUT',true);
    throw new AiError('AI_NETWORK_ERROR',true);
  }
  if(!response.ok)throw new AiError(response.status===429?'AI_RATE_LIMIT':'AI_HTTP_ERROR',response.status===429||response.status>=500);
  try {return await response.json();}
  catch {throw new AiError('AI_INVALID_RESPONSE');}
}
function tokens(value:unknown){return typeof value==='number'&&Number.isFinite(value)&&value>=0?value:undefined;}
export class ResponsesAdapter implements ModelAdapter {
  constructor(private readonly transport:HttpTransport=fetch){}
  async complete(p:ModelProfile,key:string,r:ModelRequest,signal:AbortSignal):Promise<ModelResponse>{
    const data=await post(this.transport,p,key,'/responses',{
      model:p.model,store:false,instructions:r.instructions,input:r.input,max_output_tokens:p.maxOutputTokens,
      ...(p.temperature===undefined?{}:{temperature:p.temperature}),
      text:{format:{type:'json_schema',name:r.schemaName,strict:true,schema:r.schema}},
    },signal);
    if(data.status!=='completed')throw new AiError('AI_INCOMPLETE');
    const content=(data.output||[]).flatMap((o:{content?:unknown[]})=>o.content||[]);
    if(content.some((c:{type:string})=>c.type==='refusal'))throw new AiError('AI_REFUSAL');
    const text=content.filter((c:{type:string})=>c.type==='output_text').map((c:{text:string})=>c.text).join('');
    if(!text)throw new AiError('AI_EMPTY_RESPONSE');
    return {text,actualModel:typeof data.model==='string'?data.model:undefined,inputTokens:tokens(data.usage?.input_tokens),outputTokens:tokens(data.usage?.output_tokens)};
  }
}
export class ChatCompletionsAdapter implements ModelAdapter {
  constructor(private readonly transport:HttpTransport=fetch){}
  async complete(p:ModelProfile,key:string,r:ModelRequest,signal:AbortSignal):Promise<ModelResponse>{
    const data=await post(this.transport,p,key,'/chat/completions',{
      model:p.model,messages:[{role:'system',content:r.instructions},{role:'user',content:r.input}],
      max_tokens:p.maxOutputTokens,...(p.temperature===undefined?{}:{temperature:p.temperature}),
      response_format:{type:'json_schema',json_schema:{name:r.schemaName,strict:true,schema:r.schema}},
    },signal);
    const choice=data.choices?.[0];
    if(choice?.message?.refusal)throw new AiError('AI_REFUSAL');
    if(choice?.finish_reason!=='stop')throw new AiError('AI_INCOMPLETE');
    if(typeof choice.message.content!=='string'||!choice.message.content)throw new AiError('AI_EMPTY_RESPONSE');
    return {text:choice.message.content,actualModel:typeof data.model==='string'?data.model:undefined,inputTokens:tokens(data.usage?.prompt_tokens),outputTokens:tokens(data.usage?.completion_tokens)};
  }
}
