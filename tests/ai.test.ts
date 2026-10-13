import {test} from 'node:test';
import assert from 'node:assert/strict';
import {setTimeout as delay} from 'node:timers/promises';
import type {AiAttempt,Evidence} from '../shared/types.ts';
import {parseAiConfig} from '../server/ai/config.ts';
import {AiError,type ModelAdapter,type ModelRequest} from '../server/ai/contracts.ts';
import {AiGateway} from '../server/ai/gateway.ts';
import {ResponsesAdapter,ChatCompletionsAdapter,type HttpTransport} from '../server/ai/adapters.ts';
import {GatewayAnalyzer} from '../server/inspection/provider.ts';
import {createInspectionFacade} from '../server/inspection/index.ts';
import {parseAnalysis,outputSchema} from '../server/ai/schema.ts';
const bi={ru:'Учебный пример',kk:'Оқу мысалы'};
const source:Evidence={id:'e',text:'Учебный пример: казино бонус депозит.',name:'sample',storedName:'sample',mime:'text/plain',size:0,sha256:'',method:'test',createdAt:'',kind:'text'};
const valid={likelihood:2,assessment:bi,findings:[],review:{status:'not_found',uncertainties:[],questions:[bi],contradictions:[{evidenceId:'e',quote:'Учебный пример',explanation:bi}]}};
const request:ModelRequest={instructions:'instruction',input:'untrusted source',schema:outputSchema,schemaName:'inspection_v2'};
const versions={promptVersion:'p1',schemaVersion:'s1'};
const signal=()=>new AbortController().signal;
function configuration(){
 return parseAiConfig({profiles:{
  a:{adapter:'responses',baseUrl:'https://example.test/v1',apiKeyEnv:'TEST_KEY',model:'model-a',retries:0},
  b:{adapter:'chat-completions',baseUrl:'http://127.0.0.1:4000/v1',apiKeyEnv:'OTHER_KEY',model:'model-b'},
 },routes:{context:['a'],mechanics:['a'],verification:['b']}});
}
test('three advanced stages receive prior outcomes; actual models and usage are preserved',async()=>{
 const config=configuration();const tasks:string[]=[];
 const adapter:ModelAdapter={async complete(profile,_key,r){
  const input=JSON.parse(r.input);tasks.push(profile.model);
  assert.ok(!r.instructions.includes(source.text!)); // source data remains in user input
  assert.equal(input.sources[0].text,source.text);
  if(tasks.length===3)assert.deepEqual(input.previousStages.map((s:{id:string})=>s.id),['rules','context','mechanics']);
  return {text:JSON.stringify(valid),actualModel:profile.model+'-snapshot',inputTokens:80,outputTokens:20};
 }};
 const gateway=new AiGateway(config,{responses:adapter,'chat-completions':adapter},{TEST_KEY:'secret-a',OTHER_KEY:'secret-b'});
 const result=await createInspectionFacade(new GatewayAnalyzer(gateway)).inspect({analysisLevel:'advanced',evidence:[source],links:[]});
 assert.deepEqual(tasks,['model-a','model-a','model-b']);
 assert.equal(result.run.status,'completed');assert.equal(result.run.aiAttempts,3);assert.equal(result.findings.length,0);
 assert.ok(result.run.stages[0].observations.length);
 assert.equal(result.run.stages[3].aiAttempts![0].actualModel,'model-b-snapshot');
 assert.equal(result.run.stages[3].review!.questions.length,1);
 assert.ok(!JSON.stringify(result).includes('secret-'));
});
test('basic never calls the configured gateway',async()=>{
 let calls=0;
 const adapter:ModelAdapter={async complete(){calls++;throw Error('unexpected');}};
 const result=await createInspectionFacade(new GatewayAnalyzer(new AiGateway(configuration(),{responses:adapter,'chat-completions':adapter},{TEST_KEY:'x',OTHER_KEY:'y'}))).inspect({analysisLevel:'basic',evidence:[source],links:[]});
 assert.equal(calls,0);assert.equal(result.run.aiAttempts,0);
});
test('gateway retries a transient failure then uses only explicit fallback',async()=>{
 const config=configuration();config.profiles.a.retries=1;config.routes.context=['a','b'];
 const attempts:AiAttempt[]=[];let budget=0;const models:string[]=[];
 const adapter:ModelAdapter={async complete(p){models.push(p.model);if(p.model==='model-a')throw new AiError('AI_RATE_LIMIT',true);return {text:'ok'};}};
 const result=await new AiGateway(config,{responses:adapter,'chat-completions':adapter},{TEST_KEY:'x',OTHER_KEY:'y'}).complete('context',request,versions,signal(),{beforeAttempt(){budget++;},onAttempt:a=>attempts.push(a)},x=>x);
 assert.equal(result,'ok');assert.equal(budget,3);assert.deepEqual(models,['model-a','model-a','model-b']);
 assert.deepEqual(attempts.map(a=>a.status),['failed','failed','completed']);
});
test('refusal and invalid citations do not retry or fall back',async()=>{
 for(const error of [new AiError('AI_REFUSAL'),new AiError('AI_UNGROUNDED')]){
  const config=configuration();config.routes.context=['a','b'];config.profiles.a.retries=1;
  let calls=0;
  const adapter:ModelAdapter={async complete(){calls++;throw error;}};
  await assert.rejects(new AiGateway(config,{responses:adapter,'chat-completions':adapter},{TEST_KEY:'x',OTHER_KEY:'y'}).complete('context',request,versions,signal(),{beforeAttempt(){},onAttempt(){}},x=>x),new RegExp(error.code));
  assert.equal(calls,1);
 }
});
test('gateway respects global attempt budget before transmission',async()=>{
 let called=false;
 const adapter:ModelAdapter={async complete(){called=true;return {text:'ok'};}};
 await assert.rejects(new AiGateway(configuration(),{responses:adapter},{TEST_KEY:'x'}).complete('context',request,versions,signal(),{beforeAttempt(){throw Error('AI_BUDGET_EXCEEDED');},onAttempt(){}},x=>x),/AI_BUDGET_EXCEEDED/);
 assert.equal(called,false);
});
test('cancellation stops routing and timeout bounds adapters ignoring cancellation',async()=>{
 const config=configuration();config.profiles.a.timeoutMs=100;
 const adapter:ModelAdapter={async complete(){await delay(180);return {text:'late'};}};
 const gateway=new AiGateway(config,{responses:adapter},{TEST_KEY:'x'});
 await assert.rejects(gateway.complete('context',request,versions,signal(),{beforeAttempt(){},onAttempt(){}},x=>x),/AI_TIMEOUT/);
 const controller=new AbortController();controller.abort();
 await assert.rejects(gateway.complete('context',request,versions,controller.signal,{beforeAttempt(){throw Error('must not execute');},onAttempt(){}},x=>x),/abort/i);
});
test('schemas validate contradictory quotations as well as findings',()=>{
 const body=structuredClone(valid);body.review.contradictions[0].quote='invented quote';
 assert.throws(()=>parseAnalysis(JSON.stringify(body),[source]),/AI_UNGROUNDED/);
 assert.throws(()=>parseAnalysis('{"likelihood":100}',[source]),/AI_INVALID_RESPONSE/);
 assert.equal(parseAnalysis(JSON.stringify(valid),[source]).review.status,'not_found');
});
test('oversized inputs fail visibly without sending a truncated source',async()=>{
 let called=false;
 const adapter:ModelAdapter={async complete(){called=true;return {text:''};}};
 const ai=new GatewayAnalyzer(new AiGateway(configuration(),{responses:adapter},{TEST_KEY:'x'}));
 await assert.rejects(ai.analyze([{...source,text:'x'.repeat(180001)}],{signal:signal(),task:'context'}),/AI_INPUT_TOO_LARGE/);
 assert.equal(called,false);
});
test('configuration rejects invalid routes and credentials embedded in endpoint',()=>{
 const config=configuration();
 config.routes.context=['missing'];assert.throws(()=>parseAiConfig(config),/INVALID_AI_ROUTE/);
 config.routes.context=['a'];config.profiles.a.baseUrl='https://key@example.test/v1';assert.throws(()=>parseAiConfig(config),/INVALID_AI_CONFIG/);
});
test('Responses adapter sends strict schema and extracts usage',async()=>{
 const transport:HttpTransport=async(url,options)=>{
  assert.equal(url,'https://example.test/v1/responses');
  const body=JSON.parse(options!.body as string);assert.equal(body.store,false);
  assert.equal(body.text.format.strict,true);assert.equal(body.input,request.input);
  return Response.json({status:'completed',model:'reported',output:[{content:[{type:'output_text',text:'{}'}]}],usage:{input_tokens:7,output_tokens:8}});
 };
 const result=await new ResponsesAdapter(transport).complete(configuration().profiles.a,'key',request,signal());
 assert.equal(result.actualModel,'reported');assert.equal(result.inputTokens,7);
});
test('Chat Completions adapter supports gateway model aliases and enforces completion status',async()=>{
 const transport:HttpTransport=async(url,options)=>{
  assert.equal(url,'http://127.0.0.1:4000/v1/chat/completions');
  const body=JSON.parse(options!.body as string);assert.equal(body.model,'model-b');
  assert.equal(body.response_format.json_schema.strict,true);assert.equal(body.messages[1].content,request.input);
  return Response.json({model:'actual',choices:[{finish_reason:'stop',message:{content:'{}'}}],usage:{prompt_tokens:9,completion_tokens:10}});
 };
 assert.equal((await new ChatCompletionsAdapter(transport).complete(configuration().profiles.b,'key',request,signal())).outputTokens,10);
 const truncated:HttpTransport=async()=>Response.json({choices:[{finish_reason:'length',message:{content:'{}'}}]});
 await assert.rejects(new ChatCompletionsAdapter(truncated).complete(configuration().profiles.b,'key',request,signal()),/AI_INCOMPLETE/);
});
test('provider errors are sanitized and HTTP auth failures are not retryable',async()=>{
 const transport:HttpTransport=async()=>new Response('private provider details / secret',{status:401});
 try{await new ResponsesAdapter(transport).complete(configuration().profiles.a,'key',request,signal());assert.fail('expected error');}
 catch(error){assert.ok(error instanceof AiError);assert.equal(error.retryable,false);assert.equal(error.message,'AI_HTTP_ERROR');}
});

test('ambiguous verification never presents an unsupported numeric confidence',async()=>{
 const body={...valid,likelihood:90,review:{...valid.review,status:'ambiguous' as const}};
 const adapter:ModelAdapter={async complete(){return {text:JSON.stringify(body)};}};
 const result=await createInspectionFacade(new GatewayAnalyzer(new AiGateway(configuration(),{responses:adapter,'chat-completions':adapter},{TEST_KEY:'x',OTHER_KEY:'y'}))).inspect({analysisLevel:'advanced',evidence:[source],links:[]});
 assert.equal(result.run.status,'completed');assert.equal(result.likelihood,null);
});
test('verification sees failed prerequisites and the result remains partial',async()=>{
 const adapter:ModelAdapter={async complete(_p,_k,r){
   if(r.instructions.includes('TASK: Determine'))throw new AiError('AI_REFUSAL');
   if(r.instructions.includes('TASK: Independently verify')){
     const input=JSON.parse(r.input);
     assert.equal(input.previousStages.find((s:{id:string})=>s.id==='context').status,'failed');
   }
   return {text:JSON.stringify(valid)};
 }};
 const result=await createInspectionFacade(new GatewayAnalyzer(new AiGateway(configuration(),{responses:adapter,'chat-completions':adapter},{TEST_KEY:'x',OTHER_KEY:'y'}))).inspect({analysisLevel:'advanced',evidence:[source],links:[]});
 assert.equal(result.run.status,'partial');assert.equal(result.likelihood,null);
 assert.equal(result.run.stages[3].status,'completed');
});

test('legal schema rejects invented statutes, changed quotations and unsupported findings',async()=>{
 const {parseLegal}=await import('../server/ai/legal-schema.ts');
 const {analyzeRules}=await import('../server/rules/engine.ts');
 const findings=analyzeRules([source]);
 const norm={id:'norm1',article:'6',quote:'Тестовая норма закона',evidenceId:'law',sourceUrl:'https://example.com',retrievedAt:'now',temporalStatus:'requires_review' as const};
 const hypothesis={normId:'norm1',normQuote:'норма закона',findingIds:[findings[0].id],reason:bi,missing:[bi]};
 const response={assessment:bi,hypotheses:[hypothesis]};
 assert.equal(parseLegal(JSON.stringify(response),[norm],findings).legalHypotheses.length,1);
 for(const patch of [{normId:'invented'},{normQuote:'invented'},{findingIds:['missing']}])assert.throws(()=>parseLegal(JSON.stringify({...response,hypotheses:[{...hypothesis,...patch}]}),[norm],findings),/AI_UNGROUNDED/);
});
test('pro legal request uses a separate schema and configured route without inventing evidence',async()=>{
 const {analyzeRules}=await import('../server/rules/engine.ts');const findings=analyzeRules([source]);
 const norm={id:'norm1',article:'6',quote:'Тестовая норма закона',evidenceId:'law',sourceUrl:'https://example.com',retrievedAt:'now',temporalStatus:'requires_review' as const};
 const adapter:ModelAdapter={async complete(_p,_k,r){assert.equal(r.schemaName,'legal_v1');return {text:JSON.stringify({assessment:bi,hypotheses:[{normId:'norm1',normQuote:'норма закона',findingIds:[findings[0].id],reason:bi,missing:[bi]}]})};}};
 const analyzer=new GatewayAnalyzer(new AiGateway(configuration(),{responses:adapter,'chat-completions':adapter},{TEST_KEY:'x',OTHER_KEY:'y'}));
 const result=await analyzer.analyze([source],{signal:signal(),task:'legal',candidates:findings,osint:{version:'1',status:'partial',stages:[],observations:[],legalNorms:[norm]}});
 assert.equal(result.legalHypotheses?.length,1);assert.equal(result.findings.length,0);
});

test('an unavailable optional legal profile does not disable advanced analysis',()=>{
 const config=configuration();config.routes.legal=['b'];config.routes.verification=['a'];config.routes.pro_review=['a'];
 const gateway=new AiGateway(config,{}, {TEST_KEY:'x'});
 assert.equal(gateway.available,true);
});
