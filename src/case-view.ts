import type {CaseRecord,Evidence,Finding} from '../shared/types';
/** Match preserved ancestry, not filenames or arbitrary image order. */
export function evidenceFamily(c:CaseRecord,id:string):Evidence[]{
 const source=c.evidence.find(e=>e.id===id);if(!source)return [];
 const ids=new Set<string>([id]);let parent=source.parentId;
 while(parent&&!ids.has(parent)){ids.add(parent);parent=c.evidence.find(e=>e.id===parent)?.parentId;}
 return c.evidence.filter(e=>ids.has(e.id));
}
export function findingImage(c:CaseRecord,f:Finding){
 const family=evidenceFamily(c,f.evidenceId);
 const direct=family.find(e=>e.mime.startsWith('image/'));if(direct)return direct;
 // A screenshot of a rendered page is contextual, not a crop proving the quotation.
 return c.evidence.find(e=>{
  if(e.method!=='playwright-screenshot')return false;
  const dom=c.evidence.find(a=>a.id===e.parentId);
  return family.some(a=>a.id===e.parentId||(a.method==='http-get'&&a.id===dom?.parentId));
 });
}
export function linkedHypotheses(c:CaseRecord,f:Finding){
 const stages=c.inspection?.stages||[];
 const earlierIds=stages.flatMap(s=>s.observations).filter(o=>o.evidenceId===f.evidenceId&&o.quote===f.quote).map(o=>o.id);
 return stages.flatMap(s=>s.legalHypotheses||[]).filter(h=>h.findingIds.some(id=>id===f.id||earlierIds.includes(id)));
}

export function contentVerdict(c:CaseRecord):'confirmed'|'indicators'|'not_found'|'insufficient'|'rejected'{
 const final=c.inspection?.stages?.find(s=>s.id==='pro_review'&&s.status==='completed')||c.inspection?.stages?.find(s=>s.id==='verification'&&s.status==='completed');
 if(c.status==='verified'&&c.findings.some(f=>f.decision==='accepted'))return 'confirmed';
 if(c.status==='failed'||!c.evidence.some(e=>e.text?.trim()))return 'insufficient';
 if(c.findings.length&&c.findings.every(f=>f.decision==='rejected'))return 'rejected';
 if(final?.review&&['insufficient','ambiguous'].includes(final.review.status))return 'insufficient';
 if(c.findings.length)return 'indicators';
 if(c.inspection?.status==='partial')return 'insufficient';
 return 'not_found';
}

export function primaryMaterials(c:CaseRecord){
 return c.evidence.filter(e=>e.kind==='original'||e.mime.startsWith('image/')||(e.kind==='text'&&!e.parentId));
}
export function materialFindings(c:CaseRecord,e:Evidence){
 return c.findings.filter(f=>evidenceFamily(c,f.evidenceId).some(source=>source.id===e.id)||findingImage(c,f)?.id===e.id);
}
