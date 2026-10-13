import {previewImages} from './appendices.ts';
import { createHash } from 'node:crypto';
import type { ArchiveWriter, DocumentRenderer, PackageInput, PackageResult, PdfRenderer, ReportLayout, PackageFile } from './contracts.ts';
import { verifyScript } from './verify-script.ts';

const hash=(bytes:Buffer)=>createHash('sha256').update(bytes).digest('hex');

/** Application service: validate → structure → format → assemble. Never runs analysis or updates a case. */
export class EvidencePackageService {
  private readonly layouts:Map<string,ReportLayout>;
  constructor(
    layouts:ReportLayout[],
    private readonly documents:DocumentRenderer,
    private readonly pdf:PdfRenderer,
    private readonly archive:ArchiveWriter,
  ) {
    this.layouts=new Map(layouts.map(layout=>[layout.id,layout]));
    if(this.layouts.size!==layouts.length)throw new Error('DUPLICATE_LAYOUT');
  }
  async build(input:PackageInput):Promise<PackageResult>{
    const layout=this.layouts.get(input.layoutId||'standard');
    if(!layout)throw new Error('UNKNOWN_LAYOUT');
    // Own the snapshot before any await; subsequent inspector edits cannot alter this package.
    const c=structuredClone(input.document);
    if(c.schemaVersion!=='aigak-package-input/1')throw new Error('INVALID_PACKAGE_VERSION');
    const templates={ru:Buffer.from(input.templates.ru),kk:Buffer.from(input.templates.kk)};
    const evidence=new Map(input.evidenceFiles.map(file=>[file.id,Buffer.from(file.bytes)]));
    if(evidence.size!==input.evidenceFiles.length||evidence.size!==c.evidence.length||new Set(c.evidence.map(e=>e.id)).size!==c.evidence.length)throw new Error('INVALID_EVIDENCE_LIST');
    for(const e of c.evidence){
      const bytes=evidence.get(e.id);
      if(!bytes||bytes.length!==e.size||hash(bytes)!==e.sha256)throw new Error('INTEGRITY_FAILED');
    }
    for(const f of c.findings){
      const e=c.evidence.find(e=>e.id===f.evidenceId);
      if(!e?.text||!f.quote||!Number.isInteger(f.start)||!Number.isInteger(f.end)||f.start<0||f.end<=f.start||e.text.slice(f.start,f.end)!==f.quote)throw new Error('UNGROUNDED_FINDING');
    }
    if(c.osint){
      const references=[...(c.osint.legalNorms||[]).map(n=>n.evidenceId),...(c.osint.registry?[c.osint.registry.evidenceId]:[]),...c.osint.observations.map(o=>o.evidenceId),...c.osint.stages.flatMap(s=>s.evidenceIds),...(c.osint.relations||[]).flatMap(r=>r.evidenceIds),...(c.osint.candidates||[]).flatMap(candidate=>candidate.evidenceIds)];
      if(references.some(id=>!evidence.has(id)))throw new Error('OSINT_PROVENANCE_MISSING');
    }
    for(const stage of c.inspection?.stages||[])for(const h of stage.legalHypotheses||[]){
      const allFindings=[...c.findings,...(c.inspection?.stages||[]).flatMap(s=>s.observations)];
      if(!c.osint?.legalNorms?.some(n=>n.id===h.normId&&n.quote.includes(h.normQuote))||h.findingIds.some(id=>!allFindings.some(f=>f.id===id)))throw new Error('UNGROUNDED_LEGAL_HYPOTHESIS');
    }
    for(const f of c.findings)if(f.region){const r=f.region;
      if(!c.evidence.some(e=>e.id===r.evidenceId&&e.mime.startsWith('image/'))||![r.x,r.y,r.width,r.height].every(Number.isFinite)||r.x<0||r.y<0||r.width<=0||r.height<=0||r.x+r.width>1.001||r.y+r.height>1.001)throw Error('INVALID_REGION');
    }
    // Structure both formats consistently; rejected observations remain visible.
    const order={accepted:0,pending:1,rejected:2};
    c.findings.sort((a,b)=>order[a.decision]-order[b.decision]);
    const files:PackageFile[]=[];
    const paths=new Set<string>();
    const add=(path:string,content:Buffer|string)=>{
      if(!/^[a-zA-Z0-9][a-zA-Z0-9._/-]*$/.test(path)||path.split('/').some(p=>p==='..'||p==='.'||!p)||paths.has(path))throw new Error('INVALID_PACKAGE_PATH');
      paths.add(path);files.push({path,bytes:Buffer.isBuffer(content)?content:Buffer.from(content)});
    };
    for(const e of c.evidence)add('evidence/'+e.storedName,evidence.get(e.id)!);
    add('case.json',JSON.stringify(c,null,2));
    add('audit.json',JSON.stringify(c.audit,null,2));
    if(c.revisions?.length)add('revisions.json',JSON.stringify(c.revisions,null,2));
    if(c.osint)add('osint.json',JSON.stringify(c.osint,null,2));
    if(c.inspection)add('inspection.json',JSON.stringify(c.inspection,null,2));
    c.previewImages=previewImages(c,id=>evidence.get(id)!);
    add('appendices.json',JSON.stringify(c.evidence.map((e,i)=>({number:i+1,evidenceId:e.id,path:'evidence/'+e.storedName,sha256:e.sha256})),null,2));
    const reports=[];
    for(const lang of ['ru','kk'] as const){
      const html=layout.html(c,lang);
      reports.push({lang,html});
      add(`report-${lang}.html`,html);
      add(`document-${lang}.docx`,this.documents.render(templates[lang],layout.fields(c,lang)));
      add(`template-source-${lang}.docx`,templates[lang]);
    }
    add('template-source.docx',templates.ru); // Backward-compatible RU alias.
    const warnings:string[]=[];
    if(input.includePdf!==false){
      let pdfFiles:PackageFile[]=[];
      try {
        pdfFiles=await this.pdf.render(reports);
        if(pdfFiles.length!==2||!['report-ru.pdf','report-kk.pdf'].every(path=>pdfFiles.some(f=>f.path===path&&f.bytes.length>0)))throw new Error('INCOMPLETE_PDF');
      }
      catch {pdfFiles=[];warnings.push('PDF generation unavailable. Print report-ru.html / report-kk.html to PDF.');}
      for(const file of pdfFiles)add(file.path,file.bytes);
    }
    add('README.txt','aigak — проект пакета / пакет жобасы\n\ncase.json: versioned snapshot of evidence, findings and inspector decisions.\ninspection.json: inspection stages, when available.\naudit.json: local audit chain, not externally notarized.\nevidence/: original and derived files.\ntemplate-source-ru/kk.docx: exact templates used.\nmanifest.json: hashes of every file except itself.\nverify.mjs: run node verify.mjs after unpacking.\nThis is a draft, not an official blocking order.\n'+warnings.join('\n'));
    add('verify.mjs',verifyScript);
    const manifest=files.map(f=>({path:f.path,sha256:hash(f.bytes),size:f.bytes.length}));
    add('manifest.json',JSON.stringify({format:'aigak-evidence/2',caseId:c.id,createdAt:new Date().toISOString(),status:'draft',officerReviewed:c.status==='verified',demo:c.demo,layoutId:layout.id,exportWarnings:warnings,files:manifest},null,2));
    return {bytes:await this.archive.build(files),warnings,files:manifest};
  }
}
