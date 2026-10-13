import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import JSZip from 'jszip';
import PizZip from 'pizzip';
import {EvidencePackageService} from '../server/package/service.ts';
import {DocxRenderer,StandardReportLayout,ZipArchiveWriter} from '../server/package/adapters.ts';
import type {PackageInput,PdfRenderer} from '../server/package/contracts.ts';
import {defaultTemplate} from '../server/templates.ts';
import {analyzeRules} from '../server/rules/engine.ts';
const sha=(b:Buffer)=>createHash('sha256').update(b).digest('hex');
async function fixture():Promise<PackageInput>{
 const text='Новости: казино предлагает бонус за депозит.';
 const bytes=Buffer.from(text);
 const e={id:'e1',storedName:'e1.txt',name:'source.txt',mime:'text/plain',size:bytes.length,sha256:sha(bytes),kind:'text' as const,method:'fixture',createdAt:'2026-10-13T00:00:00Z',text};
 return {document:{schemaVersion:'aigak-package-input/1',id:'p1',number:'TEST-1',title:'Independent package',createdAt:e.createdAt,status:'draft',demo:true,officer:'',notes:'',analysisLevel:'basic',engine:'rules',assessment:{ru:'Тест',kk:'Сынақ'},likelihood:null,evidence:[e],findings:analyzeRules([e]),issues:[],audit:[],clarifications:[],links:[],redirects:[]},evidenceFiles:[{id:e.id,bytes}],templates:{ru:await defaultTemplate('ru'),kk:await defaultTemplate('kk')},includePdf:false};
}
function service(pdf:PdfRenderer={async render(){throw Error('no browser');}}){
 return new EvidencePackageService([new StandardReportLayout()],new DocxRenderer(),pdf,new ZipArchiveWriter());
}
test('package service builds without a database, workflow or AI; all outputs use same snapshot',async()=>{
 const input=await fixture();input.document.findings[0].decision='rejected';input.document.findings[1].decision='accepted';
 const before=JSON.stringify(input.document);
 const result=await service().build(input);
 assert.equal(JSON.stringify(input.document),before);
 const zip=await JSZip.loadAsync(result.bytes);
 const snapshot=JSON.parse(await zip.file('case.json')!.async('string'));
 assert.equal(snapshot.findings[0].decision,'accepted');
 assert.equal(snapshot.findings.at(-1).decision,'rejected');
 assert.equal(snapshot.findings.length,input.document.findings.length);
 for(const lang of ['ru','kk']){
  assert.equal(sha(await zip.file('template-source-'+lang+'.docx')!.async('nodebuffer')),sha(input.templates[lang as 'ru'|'kk']));
  const xml=new PizZip(await zip.file('document-'+lang+'.docx')!.async('nodebuffer')).file('word/document.xml')!.asText();
  assert.ok(xml.includes('2.0.0'));assert.ok(xml.includes('reporting')===false); // localized context, no internal context ID
  assert.ok((await zip.file('report-'+lang+'.html')!.async('string')).includes('2.0.0'));
 }
 for(const file of result.files)assert.equal(sha(await zip.file(file.path)!.async('nodebuffer')),file.sha256);
});
test('tampered, missing or duplicate evidence is rejected before formatting',async()=>{
 const input=await fixture();
 input.evidenceFiles[0].bytes=Buffer.from('tampered');
 await assert.rejects(service().build(input),/INTEGRITY_FAILED/);
 input.evidenceFiles=[];
 await assert.rejects(service().build(input),/INVALID_EVIDENCE_LIST/);
});
test('unsupported quotes and unsafe archive paths are rejected',async()=>{
 const input=await fixture();input.document.findings[0].quote='invented';
 await assert.rejects(service().build(input),/UNGROUNDED_FINDING/);
 input.document.findings=[];input.document.evidence[0].storedName='../outside.txt';
 await assert.rejects(service().build(input),/INVALID_PACKAGE_PATH/);
});
test('PDF failure produces explicit warning and preserves DOCX, HTML and originals',async()=>{
 const input=await fixture();input.includePdf=true;
 const result=await service().build(input);assert.equal(result.warnings.length,1);
 const zip=await JSZip.loadAsync(result.bytes);
 for(const file of ['report-ru.html','document-ru.docx','evidence/e1.txt'])assert.ok(zip.file(file));
 const manifest=JSON.parse(await zip.file('manifest.json')!.async('string'));
 assert.deepEqual(manifest.exportWarnings,result.warnings);
});
test('snapshot survives concurrent caller edits while awaiting PDF',async()=>{
 const input=await fixture();input.includePdf=true;
 let resume!:()=>void;let started!:()=>void;
 const begun=new Promise<void>(resolve=>{started=resolve;});
 const gate=new Promise<void>(resolve=>{resume=resolve;});
 const pending=service({async render(){started();await gate;return [];}}).build(input);
 await begun;input.document.title='changed';input.evidenceFiles[0].bytes.fill(0);resume();
 const zip=await JSZip.loadAsync((await pending).bytes);
 assert.equal(JSON.parse(await zip.file('case.json')!.async('string')).title,'Independent package');
 assert.ok((await zip.file('evidence/e1.txt')!.async('string')).includes('казино'));
});
test('alternative layout is injected without changing the package service',async()=>{
 const input=await fixture();input.layoutId='department';
 const standard=new StandardReportLayout();
 const layout={id:'department',html:()=>'<p>Department report</p>',fields:standard.fields};
 const custom=new EvidencePackageService([layout],new DocxRenderer(),{async render(){return [];}},new ZipArchiveWriter());
 const zip=await JSZip.loadAsync((await custom.build(input)).bytes);
 assert.equal(await zip.file('report-ru.html')!.async('string'),'<p>Department report</p>');
 input.layoutId='unknown';await assert.rejects(custom.build(input),/UNKNOWN_LAYOUT/);
});

test('OSINT snapshots are exported and orphaned source references block the package',async()=>{
 const input=await fixture();input.document.osint={version:'1',status:'partial',stages:[],observations:[{id:'o',kind:'email',value:'office@example.com',evidenceId:'e1',collector:'test',status:'observed',collectedAt:'now'}]};
 const zip=await JSZip.loadAsync((await service().build(input)).bytes);
 assert.ok(zip.file('osint.json'));assert.ok((await zip.file('report-ru.html')!.async('string')).includes('office@example.com'));
 input.document.osint.observations[0].evidenceId='missing';
 await assert.rejects(service().build(input),/OSINT_PROVENANCE_MISSING/);
});
