import { test } from 'node:test';
import assert from 'node:assert/strict';
import type { Evidence } from '../shared/types.ts';
import { createInspectionFacade } from '../server/inspection/index.ts';
import { InspectionFacade } from '../server/inspection/facade.ts';
import { CheckRegistry } from '../server/inspection/registry.ts';
import { StrategyFactory, AdvancedStrategy, ProStrategy } from '../server/inspection/strategies.ts';
import { analyzeRules } from '../server/rules/engine.ts';
import { hydrateCase } from '../server/store.ts';

const text='Онлайн-казино. Бонус на первый депозит и фриспины.';
const evidence:Evidence={id:'source',name:'source.txt',storedName:'source.txt',mime:'text/plain',size:Buffer.byteLength(text),sha256:'test',kind:'original',method:'test',createdAt:new Date().toISOString(),text};
const input={evidence:[evidence],links:[]};
const assessment={ru:'Контекст проверен',kk:'Мәнмәтін тексерілді'};
test('basic never invokes an available AI provider',async()=>{
 const result=await createInspectionFacade({available:true,async analyze(){throw Error('must not call');}}).inspect({...input,analysisLevel:'basic'});
 assert.equal(result.run.status,'completed');assert.equal(result.run.aiCalls,0);assert.equal(result.likelihood,null);assert.ok(result.findings.length);
});
test('missing AI is explicit partial success with grounded rules retained',async()=>{
 const result=await createInspectionFacade({available:false,async analyze(){throw Error('must not call');}}).inspect({...input,analysisLevel:'advanced'});
 assert.equal(result.run.status,'partial');assert.equal(result.run.stages[1].status,'skipped');assert.ok(result.findings.length);assert.equal(result.likelihood,null);
});
test('advanced context can remove false positives while preserving rule observations',async()=>{
 const result=await createInspectionFacade({available:true,async analyze(_,options){assert.ok(['context','mechanics','verification'].includes(options.task));return {findings:[],assessment,likelihood:3};}}).inspect({...input,analysisLevel:'advanced'});
 assert.equal(result.findings.length,0);assert.ok(result.run.stages[0].observations.length);assert.equal(result.likelihood,3);assert.equal(result.run.aiCalls,3);
});
test('pro executes advanced checks and explicitly skips unconnected legal and external checks',async()=>{
 let calls=0;
 const result=await createInspectionFacade({available:true,async analyze(){calls++;return {findings:analyzeRules([evidence]),assessment,likelihood:90};}}).inspect({...input,analysisLevel:'pro'});
 assert.equal(calls,4);assert.equal(result.run.stages.length,8);assert.equal(result.run.status,'partial');assert.equal(result.likelihood,null);
 assert.deepEqual(result.run.stages.filter(s=>s.status==='skipped').map(s=>s.id),['connections','legal']);
});
test('ungrounded AI findings are rejected without losing prior evidence',async()=>{
 const result=await createInspectionFacade({available:true,async analyze(){return {findings:[{...analyzeRules([evidence])[0],quote:'invented'}],assessment,likelihood:99};}}).inspect({...input,analysisLevel:'advanced'});
 assert.equal(result.run.stages[1].errorCode,'UNGROUNDED_FINDING');assert.ok(result.findings.length);assert.equal(result.likelihood,null);
});
test('provider error is sanitized and remaining integrity stage still runs',async()=>{
 const result=await createInspectionFacade({available:true,async analyze(){throw Error('secret credentials / raw response');}}).inspect({...input,analysisLevel:'advanced'});
 assert.equal(result.run.stages[1].errorCode,'CHECK_FAILED');assert.equal(result.run.stages[4].status,'completed');assert.ok(!JSON.stringify(result).includes('secret'));
});
test('custom registry and strategy enforce deadline for a provider ignoring cancellation',async()=>{
 const registry=new CheckRegistry().register('slow',()=>({id:'slow',version:'1',name:assessment,requiresAi:false,execute:()=>new Promise(()=>{})}));
 const strategies=new StrategyFactory({basic:()=>({level:'basic',checks:['slow'],maxAiCalls:0,timeoutMs:15}),advanced:()=>new AdvancedStrategy(),pro:()=>new ProStrategy()});
 const result=await new InspectionFacade(registry,strategies,{available:false,async analyze(){throw Error('unexpected');}}).inspect({...input,analysisLevel:'basic'});
 assert.equal(result.run.stages[0].errorCode,'ANALYSIS_TIMEOUT');
 assert.throws(()=>registry.register('slow',()=>{throw Error('unused');}),/DUPLICATE/);
});
test('legacy saved cases hydrate their level without changing old audit records',()=>{
 for(const useAi of [true,false]){const audit=[{hash:'unchanged'}];const c=hydrateCase(JSON.stringify({useAi,audit}));assert.equal(c.analysisLevel,useAi?'advanced':'basic');assert.deepEqual(c.audit,audit);}
});
