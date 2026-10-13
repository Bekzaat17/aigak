import {test} from 'node:test';
import assert from 'node:assert/strict';
import type { Evidence } from '../shared/types.ts';
import {analyzeRules} from '../server/rules/engine.ts';
import {createInspectionFacade} from '../server/inspection/index.ts';

function source(text:string,id='e'):Evidence {
 return {id,text,name:'input.txt',storedName:id,mime:'text/plain',size:Buffer.byteLength(text),sha256:'test',kind:'text',method:'fixture',createdAt:'2026-10-13T00:00:00Z'};
}
const corpus=[
 {name:'RU offer',text:'Онлайн-казино: играйте сейчас! Бонус за первый депозит. Выигрыши каждый день.',combo:true,context:undefined},
 {name:'KK offer',text:'Құмар ойын. Тіркеліңіз! Бонус алыңыз. Ақша салу. Бәс тігіңіз.',combo:true,context:undefined},
 {name:'RU news quoting advertisement',text:'Новости: журналист сообщает о рекламе: «Казино, бонус за депозит».',combo:true,context:'reporting'},
 {name:'KK prevention',text:'Құмар ойынға тыйым салынады. Тәуелділіктің алдын алу: ойнамаңыз.',combo:false,context:'prevention'},
 {name:'RU warning',text:'Не играйте в казино. Профилактика зависимости.',combo:false,context:'prevention'},
 {name:'teaching',text:'Учебный пример: казино предлагает бонус за депозит.',combo:true,context:'educational'},
 {name:'ordinary promotion',text:'Банк предлагает бонус за депозит.',combo:false,context:undefined},
];
for(const item of corpus)test(item.name+': grounded findings and contextual caveats',()=>{
 const findings=analyzeRules([source(item.text)]);
 assert.equal(findings.some(f=>f.rule?.id==='offer-with-payments'),item.combo);
 if(item.context)assert.ok(findings.some(f=>f.rule?.contexts.some(c=>c.id===item.context)));
 for(const f of findings){
  assert.equal(item.text.slice(f.start,f.end),f.quote);
  assert.ok(f.rule?.id);assert.equal(f.decision,'pending');
  for(const m of f.rule!.matches){assert.equal(item.text.slice(m.start,m.end),m.text);assert.ok(m.start>=f.start&&m.end<=f.end);}
  for(const c of f.rule!.contexts)assert.equal(item.text.slice(c.start,c.end),c.quote);
 }
});
test('unrelated substrings do not produce indicators',()=>{
 assert.deepEqual(analyzeRules([source('Доставка товара. Кислота. Переставка мебели. Подставки.')]),[]);
});
test('combinations do not connect different sources, distant passages or paragraphs',()=>{
 for(const evidence of [
  [source('Казино','a'),source('Бонус за депозит','b')],
  [source('Казино.'+' нейтральный текст'.repeat(40)+' Бонус за депозит.')],
  [source('Казино.\n\nБонус за депозит.')],
  [source('Казино.\r\n \r\nБонус за депозит.')],
 ])assert.ok(!analyzeRules(evidence).some(f=>f.rule?.id==='offer-with-payments'));
});
test('identical extracted content does not count twice and repeats are bounded',()=>{
 const text='Казино бонус депозит. '.repeat(40);
 const single=analyzeRules([source(text)]);
 assert.equal(analyzeRules([source(text,'a'),source(text,'b')]).length,single.length);
 for(const id of new Set(single.map(f=>f.rule!.id)))assert.ok(single.filter(f=>f.rule!.id===id).length<=3);
});
test('rules preserve original Unicode offsets, punctuation and casing',()=>{
 const text='🎲 КАЗИНО — бонус за депозит!\nҚұмар ойын.';
 for(const f of analyzeRules([source(text)]))assert.equal(text.slice(f.start,f.end),f.quote);
});
test('facade retains combinations even if quote/category match a term finding',async()=>{
 const result=await createInspectionFacade({available:false,async analyze(){throw Error('AI forbidden');}}).inspect({analysisLevel:'basic',links:[],evidence:[source('Казино бонус депозит')]});
 assert.ok(result.findings.some(f=>f.rule?.id==='offer-with-payments'));
 assert.equal(result.likelihood,null);assert.equal(result.run.aiCalls,0);
 assert.equal(result.run.stages[0].version,'2.0.0');
});
