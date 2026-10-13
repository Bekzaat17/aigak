import type { CaseRecord, Lang } from '../shared/types.ts';
import { Store } from './store.ts';
import { browserOptions } from './collector.ts';
import { Templates } from './templates.ts';
import { createPackageService } from './package/index.ts';
import type { PackageDocument } from './package/contracts.ts';
import type { EvidencePackageService } from './package/service.ts';
import { reportHtml as renderHtml } from './package/html.ts';

/** Workflow adapter: only this layer knows CaseRecord, storage and audit mutation. */
export function packageDocument(c:CaseRecord):PackageDocument {
  return structuredClone({
    schemaVersion:'aigak-package-input/1',id:c.id,number:c.number,title:c.title,
    sourceUrl:c.sourceUrl,createdAt:c.createdAt,status:c.status==='verified'?'verified':'draft',
    demo:c.demo,officer:c.officer,notes:c.notes,analysisLevel:c.analysisLevel,engine:c.engine,
    assessment:c.assessment,likelihood:c.likelihood,evidence:c.evidence,findings:c.findings,
    issues:c.issues,inspection:c.inspection,audit:c.audit,clarifications:c.clarifications,
    links:c.links,redirects:c.redirects,
  });
}
export function reportHtml(c:CaseRecord,lang:Lang){return renderHtml(packageDocument(c),lang);}
export async function exportCase(store:Store,c:CaseRecord,includePdf=true,service:EvidencePackageService=createPackageService(browserOptions())) {
  store.verify(c);
  store.event(c,'package.export.requested',c.status==='verified'?'officer-reviewed draft':'unreviewed draft');
  const document=packageDocument(c);
  const evidenceFiles=c.evidence.map(e=>({id:e.id,bytes:store.read(c,e)}));
  const templates=new Templates(store);
  const result=await service.build({
    document,evidenceFiles,templates:{ru:await templates.raw(c.templateId,'ru'),kk:await templates.raw(c.templateId,'kk')},includePdf,
  });
  return result.bytes;
}
