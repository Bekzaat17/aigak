import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {Store} from '../server/store.ts';
import {newCase} from '../server/workflow.ts';
import {startRevision,syncQuestions} from '../server/revisions.ts';
import {createInspectionFacade} from '../server/inspection/index.ts';
import {contentSignals,ResourceInvestigator,CertificateTransparencyProvider} from '../server/osint/discovery.ts';
import {parseLegalArticles} from '../server/osint/legal-corpus.ts';
import {buildDossier} from '../shared/dossier.ts';
import {reportHtml} from '../server/package/html.ts';
import {packageDocument} from '../server/export.ts';
import type {OsintReport} from '../shared/osint.ts';
import type {Evidence} from '../shared/types.ts';
const report=():OsintReport=>({version:'1',status:'partial',hostname:'example.com',registrationDomain:'example.com',observations:[],stages:[],relations:[],candidates:[]});
const source=(text:string):Evidence=>({id:'source',name:'text.txt',storedName:'text.txt',mime:'text/plain',size:text.length,sha256:'',createdAt:new Date().toISOString(),kind:'text',method:'test',text,sourceUrl:'https://example.com/'});
test('revision freezes decisions and responses, invalidates approval, blocks overlapping runs',()=>{
 const dir=mkdtempSync(join(tmpdir(),'aigak-revision-'));const store=new Store(dir);
 try{const c=newCase(store,{title:'QA',sourceType:'text',useAi:false});c.status='verified';c.reviewedAt='2026-01-01';c.followUps=[{id:'q',question:{ru:'Почему?',kk:'Неге?'},answer:'Ответ',evidenceIds:[]}];
 startRevision(store,c,'pro');assert.equal(c.status,'queued');assert.equal(c.reviewedAt,undefined);assert.equal(c.revisions?.[0].status,'verified');
 c.followUps[0].answer='Changed';assert.equal(c.revisions?.[0].followUps[0].answer,'Ответ');assert.throws(()=>startRevision(store,c,'basic'),/CASE_BUSY/);store.verify(c);c.revisions![0].followUps[0].answer='Tampered';assert.throws(()=>store.verify(c),/INTEGRITY_FAILED/);
 }finally{store.close();rmSync(dir,{recursive:true,force:true});}
});
test('AI receives inspector responses separately from evidence; questions deduplicate',async()=>{
 const questions=[{ru:'Уточнить источник',kk:'Дереккөзді нақтылау'}];const responses=[{id:'q',question:questions[0],answer:'Инспектор пояснил',evidenceIds:[]}];let seen=0;
 const result=await createInspectionFacade({available:true,async analyze(e,options){assert.deepEqual(options.inspectorResponses,responses);assert.equal(e.length,1);seen++;return {findings:[],assessment:{ru:'Нет',kk:'Жоқ'},likelihood:0,review:{status:'not_found',questions,uncertainties:[],contradictions:[]}};}}).inspect({analysisLevel:'advanced',evidence:[source('Новость')],links:[],followUps:responses});
 assert.equal(seen,3);const c={inspection:result.run} as Parameters<typeof syncQuestions>[0];syncQuestions(c);assert.equal(c.followUps?.length,1);assert.equal(c.followUps?.[0].answer,'');
});
test('content comparison requires substantial text and keeps signals separate',()=>{
 const text=Array.from({length:65},(_,i)=>'слово'+i).join(' ');const match=contentSignals(text+' info@example.com БИН: 123456789012',text+' info@example.com БИН: 123456789012');
 assert.equal(match.similarity,1);assert.deepEqual(match.bins,['123456789012']);assert.deepEqual(match.emails,['info@example.com']);assert.equal(contentSignals('hello','hello').similarity,0);
});
test('candidate content is preserved, grounded and bounded; failures remain explicit',async()=>{
 const r=report();r.relations=[{id:'a',from:'example.com',to:'example.net',kind:'links_to',evidenceIds:['source'],status:'observed',checkedAt:''}];
 let requests=0;const text=Array.from({length:65},(_,i)=>'word'+i).join(' ')+' info@example.com';const evidence=[source(text)];
 const service=new ResourceInvestigator([],async(url)=>{requests++;return {url,status:200,headers:{'content-type':'text/html'},body:Buffer.from('<p>'+text+'</p>'),redirects:[]};},1);
 await service.investigate(r,evidence,(a)=>{const e={...source(a.text||''),id:'e'+evidence.length,mime:a.mime,sourceUrl:a.sourceUrl};evidence.push(e);return e;});
 assert.equal(requests,1);assert.equal(r.candidates?.[0].status,'content_checked');assert.ok(r.relations?.some(x=>x.kind==='shared_contact'&&x.evidenceIds.length===2));assert.ok(r.relations?.every(x=>x.status==='observed'&&!x.decision));
});
test('certificate discovery rejects wildcard/private/outside names',async()=>{
 const ct=new CertificateTransparencyProvider(async(url)=>({url,status:200,headers:{},redirects:[],body:Buffer.from(JSON.stringify([{name_value:'*.example.com\nvalid.example.com\nattacker.net\nlocalhost'}]))}));
 const result=await ct.discover('example.com',AbortSignal.timeout(1000));assert.deepEqual(result.hosts,['valid.example.com']);
});
test('legal parser supports bold paragraph headings and stops at the next article',()=>{
 const s={id:'law',url:'https://example.com',title:{ru:'Закон',kk:'Заң'},identity:'identity',articles:['13']};
 const html='<body>identity<p><b>Статья 13. Реклама</b></p><p>'+('Допустимый текст нормы. '.repeat(10))+'</p><p><b>Статья 14. Иная</b></p><p>НЕ ВКЛЮЧАТЬ</p></body>';
 const [n]=parseLegalArticles(html,s);assert.ok(n.quote.includes('Допустимый'));assert.ok(!n.quote.includes('НЕ ВКЛЮЧАТЬ'));assert.throws(()=>parseLegalArticles(html.replace('identity','wrong'),s),/IDENTITY/);
});
test('dossier never claims readiness with missing legal/AI context',()=>{
 const c={evidence:[source('casino')],findings:[],clarifications:[],status:'review' as const};assert.equal(buildDossier(c).ready,false);assert.equal(buildDossier({...c,materialsPending:true}).tasks.find(t=>t.id==='gaps')?.status,'missing');assert.ok(buildDossier(c).tasks.some(t=>t.id==='law'&&t.status==='missing'));
});
test('HTML package preserves appendix anchors, inspector statements and escaped text',()=>{
 const dir=mkdtempSync(join(tmpdir(),'aigak-package-'));const store=new Store(dir);
 try{const c=newCase(store,{title:'<script>QA</script>',sourceType:'text',useAi:false});c.evidence=[source('Text')];c.followUps=[{id:'q',question:{ru:'Вопрос',kk:'Сұрақ'},answer:'Ответ\nВторая строка',evidenceIds:['source']}];const html=reportHtml(packageDocument(c),'ru');assert.ok(html.includes('id="appendix-1"'));assert.ok(html.includes('Ответ\nВторая строка'));assert.ok(!html.includes('<script>QA'));
 }finally{store.close();rmSync(dir,{recursive:true,force:true});}
});
test('findings on a discovered domain are scoped separately from the target',async()=>{
 const result=await createInspectionFacade({available:false,async analyze(){throw Error('unused');}}).inspect({analysisLevel:'basic',evidence:[{...source('Онлайн-казино. Пополните счёт.'),method:'detective-text@1',sourceUrl:'https://other.example.com'}],links:[]});
 assert.ok(result.findings.length);assert.ok(result.findings.every(f=>f.scope==='related'));
 const {contentVerdict}=await import('../src/case-view.ts');
 const c={evidence:[source('text')],findings:result.findings,status:'review',inspection:result.run} as Parameters<typeof contentVerdict>[0];
 assert.equal(contentVerdict(c),'insufficient');
});
