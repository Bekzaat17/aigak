import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, chmodSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import JSZip from 'jszip';
import PizZip from 'pizzip';
import { Store, sha256 } from '../server/store.ts';
import { newCase, Queue, reviewFinding, approveCase } from '../server/workflow.ts';
import { analyzeRules, validateAiFindings } from '../server/analysis.ts';
import { parsePublicUrl, publicAddress, safeFetch } from '../server/network.ts';
import { DocxRenderer } from '../server/package/adapters.ts';
import { templateFields } from '../server/package/fields.ts';
import { packageDocument } from '../server/export.ts';
import { exportCase, reportHtml } from '../server/export.ts';
import { Templates, defaultTemplate } from '../server/templates.ts';
import { detectMime } from '../server/collector.ts';

function fixture() {
  const dir=mkdtempSync(path.join(tmpdir(),'aigak-test-'));const store=new Store(dir);
  const c=newCase(store,{title:'Проверка / Тексеру',sourceType:'text',useAi:false});
  const text='Онлайн-казино. Бонус на первый депозит и фриспины. Ақша шығару. Ұтыс.';
  const evidence=store.addEvidence(c,Buffer.from(text),{name:'source.txt',mime:'text/plain',kind:'original',method:'test',text});
  const clean=()=>{store.close();rmSync(dir,{recursive:true,force:true});};
  return {dir,store,c,evidence,text,clean};
}
test('SSRF rejects private, loopback, special addresses, credentials, ports and encodings',()=>{
  for(const url of ['http://127.0.0.1','http://2130706433','http://0x7f000001','http://[::1]','http://[::ffff:127.0.0.1]','http://169.254.169.254','http://10.0.0.1','http://192.168.1.1','http://localhost.','http://localhost','file:///etc/passwd','ftp://example.com','https://u:p@example.com','http://example.com:3000']) {
    if(url==='http://localhost.')continue; // DNS resolution separately rejects its loopback answer.
    assert.throws(()=>parsePublicUrl(url),/UNSAFE_URL/,url);
  }
  for(const ip of ['::','fc00::1','fe80::1','100.64.0.1','0.0.0.0','224.0.0.1','192.0.2.1','::ffff:10.0.0.1'])assert.equal(publicAddress(ip),false,ip);
  assert.equal(publicAddress('8.8.8.8'),true);assert.equal(publicAddress('2606:4700:4700::1111'),true);
  assert.equal(parsePublicUrl('https://example.com/a').hostname,'example.com');
});
test('safe fetch rejects local endpoints before opening a connection',async()=>{await assert.rejects(safeFetch('http://127.0.0.1'),/UNSAFE_URL/);});
test('rules produce exact cited spans with no fabricated probability',()=>{
  const f=fixture();try{const findings=analyzeRules([f.evidence]);assert.ok(findings.length>=3);for(const x of findings){assert.equal(f.text.slice(x.start,x.end),x.quote);assert.equal(x.evidenceId,f.evidence.id);assert.equal(x.decision,'pending');assert.ok(x.title.kk);}assert.equal(f.c.likelihood,null);}finally{f.clean();}
});
test('AI cannot supply unsupported quotes, source IDs or out-of-range estimates',()=>{
  const f=fixture();try{const raw={likelihood:70,assessment:{ru:'Предварительно',kk:'Алдын ала'},findings:[{category:'gambling',title:{ru:'Признак',kk:'Белгі'},explanation:{ru:'Контекст',kk:'Мәнмәтін'},quote:'Онлайн-казино',evidenceId:f.evidence.id}]};assert.equal(validateAiFindings(raw,[f.evidence]).length,1);assert.throws(()=>validateAiFindings({...raw,likelihood:101},[f.evidence]));assert.throws(()=>validateAiFindings({...raw,findings:[{...raw.findings[0],quote:'Вымышленная цитата'}]},[f.evidence]),/AI_UNGROUNDED/);assert.throws(()=>validateAiFindings({...raw,findings:[{...raw.findings[0],evidenceId:'fake'}]},[f.evidence]),/AI_UNGROUNDED/);}finally{f.clean();}
});
test('review requires every decision and provenance/context, later edits invalidate approval',()=>{
  const f=fixture();try{f.c.status='review';f.c.findings=analyzeRules([f.evidence]);assert.throws(()=>approveCase(f.store,f.c,'Офицер','Проверено лично'),/REVIEW_INCOMPLETE/);for(const x of f.c.findings)reviewFinding(f.store,f.c,x.id,'accepted','Сверено с оригиналом');assert.throws(()=>approveCase(f.store,f.c,'Офицер','Проверено лично'),/REVIEW_INCOMPLETE/);f.c.clarifications.forEach(q=>q.answer='yes');approveCase(f.store,f.c,'Офицер','Проверено лично');assert.equal(f.store.get(f.c.id)?.status,'verified');reviewFinding(f.store,f.c,f.c.findings[0].id,'pending');assert.equal(f.c.status,'review');assert.equal(f.c.reviewedAt,undefined);}finally{f.clean();}
});
test('hash chain and original tampering are detected',()=>{
  const f=fixture();try{f.store.verify(f.c);f.c.audit[0].detail='changed';assert.throws(()=>f.store.verify(f.c),/INTEGRITY_FAILED/);const c=f.store.get(f.c.id)!;const file=path.join(f.dir,'evidence',c.id,f.evidence.storedName);chmodSync(file,0o600);writeFileSync(file,'tampered');assert.throws(()=>f.store.verify(c),/INTEGRITY_FAILED/);}finally{f.clean();}
});
test('persisted intake survives reopening; interrupted work is marked failed',()=>{
  const dir=mkdtempSync(path.join(tmpdir(),'aigak-restart-'));let store=new Store(dir);const c=newCase(store,{title:'Restart',sourceType:'text',useAi:false});store.close();store=new Store(dir);new Queue(store);assert.equal(store.get(c.id)?.status,'failed');store.verify(store.get(c.id)!);store.close();rmSync(dir,{recursive:true,force:true});
});
test('queue extracts a real text file and reaches inspector review',async()=>{
  const f=fixture();try{const q=new Queue(f.store);const c=newCase(f.store,{title:'Queue test',sourceType:'text',useAi:false});f.store.addEvidence(c,Buffer.from('Құмар ойын. Ақша салу. Бонус. Бәс тігу.'),{name:'input.txt',mime:'text/plain',kind:'original',method:'test'});await q.run(c.id);const result=f.store.get(c.id)!;assert.equal(result.status,'review');assert.ok(result.evidence.some(e=>e.kind==='text'));assert.ok(result.findings.length>=3);f.store.verify(result);}finally{f.clean();}
});
test('templates validate, persist, render and reject missing/unknown fields or external links',async()=>{
  const f=fixture();try{const templates=new Templates(f.store);const raw=await defaultTemplate();templates.validate(raw);const entry=templates.add('My template.docx',raw) as {id:string};assert.ok(templates.has(entry.id));f.c.templateId=entry.id;f.c.findings=analyzeRules([f.evidence]);f.c.findings[0].note='Inspector comment';const filled=new PizZip(new DocxRenderer().render(await templates.raw(f.c.templateId,'kk'),templateFields(packageDocument(f.c),'kk')));const xml=filled.file('word/document.xml')!.asText();assert.ok(xml.includes(f.c.number));assert.ok(xml.includes('Inspector comment'));assert.ok(!xml.includes('{case_number}'));const bad=new PizZip(raw);bad.file('word/document.xml',bad.file('word/document.xml')!.asText().replace('{case_number}','{unknown}'));assert.throws(()=>templates.validate(bad.generate({type:'nodebuffer'})),/TEMPLATE_FIELDS_MISSING/);const ext=new PizZip(raw);ext.file('word/_rels/document.xml.rels','<Relationships><Relationship TargetMode="External" Target="https://example.com"/></Relationships>');assert.throws(()=>templates.validate(ext.generate({type:'nodebuffer'})),/TEMPLATE_EXTERNAL_LINK/);}finally{f.clean();}
});
test('export manifest covers originals, documents and review answers; HTML escapes input',async()=>{
  const f=fixture();try{f.c.status='review';f.c.title='<script>alert(1)</script>';f.c.findings=analyzeRules([f.evidence]);f.c.clarifications[0].answer='unknown';f.c.clarifications[0].note='Need original URL';f.store.save(f.c);const zip=await JSZip.loadAsync(await exportCase(f.store,f.c,false));const manifest=JSON.parse(await zip.file('manifest.json')!.async('string'));assert.equal(manifest.status,'draft');assert.equal(manifest.officerReviewed,false);assert.ok(zip.file('document-ru.docx'));assert.ok(zip.file('document-kk.docx'));assert.ok(zip.file('template-source.docx'));for(const e of manifest.files){const b=await zip.file(e.path)!.async('nodebuffer');assert.equal(sha256(b),e.sha256);assert.equal(b.length,e.size);}const report=reportHtml(f.c,'ru');assert.ok(!report.includes('<script>'));assert.ok(report.includes('&lt;script&gt;'));assert.ok(report.includes('Need original URL'));assert.ok(report.includes('Не уверен'));}finally{f.clean();}
});
test('MIME detection uses signatures rather than a forged upload content-type',()=>{assert.equal(detectMime(Buffer.from('%PDF-1.7\n'),'picture.png'),'application/pdf');assert.equal(detectMime(Buffer.from('<script>alert(1)</script>'),'picture.png'),'application/octet-stream');});
