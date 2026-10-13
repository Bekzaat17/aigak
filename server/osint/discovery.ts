import {randomUUID} from 'node:crypto';
import {safeFetch} from '../network.ts';
import {htmlText} from '../collector.ts';
import {domainTarget} from './domain.ts';
import type {Evidence} from '../../shared/types.ts';
import type {OsintReport,ResourceRelation} from '../../shared/osint.ts';
import type {SaveArtifact} from './contracts.ts';
export interface DiscoveryProvider {id:string;discover(domain:string,signal:AbortSignal):Promise<{hosts:string[];bytes:Buffer;url:string}>}
export class CertificateTransparencyProvider implements DiscoveryProvider {
 id='certificate-transparency';
 constructor(private fetcher:typeof safeFetch=safeFetch){}
 async discover(domain:string,signal:AbortSignal){
  const url='https://crt.sh/?q='+encodeURIComponent('%.'+domain)+'&output=json';
  const response=await this.fetcher(url,2*1024*1024,2,signal);
  if(response.status!==200)throw Error('CT_UNAVAILABLE');
  const rows:unknown=JSON.parse(response.body.toString());if(!Array.isArray(rows))throw Error('CT_FORMAT');
  const hosts=new Set<string>();
  for(const row of rows.slice(0,5000))for(const name of String(row.name_value||'').split('\n')){
   try {if(name.includes('*'))continue;const host=domainTarget('https://'+name).hostname;
    if(host===domain||host.endsWith('.'+domain))hosts.add(host);
   }catch{}
  }
  return {hosts:[...hosts].sort().slice(0,30),bytes:response.body,url:response.url};
 }
}
export function contentSignals(a:string,b:string){
 const email=(s:string)=>new Set(s.toLowerCase().match(/[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}/g)||[]);
 const bins=(s:string)=>new Set([...s.matchAll(/(?:БИН|БСН|BIN)\s*[:№-]?\s*(\d{12})/giu)].map(m=>m[1]));
 const common=(x:Set<string>,y:Set<string>)=>[...x].filter(v=>y.has(v));
 const grams=(s:string)=>{const w=s.toLowerCase().match(/[\p{L}\p{N}]+/gu)||[];return new Set(w.slice(0,10000).flatMap((_,i)=>i+5<=w.length?[w.slice(i,i+5).join(' ')]:[]));};
 const x=grams(a),y=grams(b);const overlap=common(x,y).length;const similarity=x.size&&y.size?overlap/(x.size+y.size-overlap):0;
 return {emails:common(email(a),email(b)),bins:common(bins(a),bins(b)),similarity:x.size>=30&&y.size>=30?similarity:0};
}
/** Bounded one-hop discovery, separate from reasoning and package rendering. */
export class ResourceInvestigator {
 constructor(private providers:DiscoveryProvider[]=[new CertificateTransparencyProvider()],private fetcher:typeof safeFetch=safeFetch,private limit=5){}
 async investigate(report:OsintReport,evidence:Evidence[],save:SaveArtifact){
  if(!report.hostname)return;
  const started=Date.now();const signal=AbortSignal.timeout(45000);report.relations??=[];report.candidates??=[];
  const seeds=new Set(report.relations.filter(r=>r.kind!=='resolves_to').map(r=>r.to));
  const addRelation=(to:string,kind:ResourceRelation['kind'],ids:string[],description?:string)=>{
   if(report.relations!.length>=200)return;
   report.relations!.push({id:randomUUID(),from:report.hostname!,to,kind,evidenceIds:ids,status:'observed',checkedAt:new Date().toISOString(),description});
  };
  for(const provider of this.providers){
   try {
    const found=await provider.discover(report.siteDomain||report.registrationDomain||report.hostname,signal);
    const raw=save({name:'discovery-'+provider.id+'.json',mime:'application/json',bytes:found.bytes,sourceUrl:found.url},'detective-discovery@1');
    found.hosts.filter(h=>h!==report.hostname).forEach(host=>{seeds.add(host);addRelation(host,'ct_contains',[raw.id]);});
    report.stages.push({id:provider.id,version:'1',status:'completed',durationMs:Date.now()-started,evidenceIds:[raw.id],summary:{ru:`История сертификатов: найдено имён ${found.hosts.length}. Запись может быть устаревшей.`,kk:`Сертификаттар тарихы: ${found.hosts.length} атау табылды. Жазба ескірген болуы мүмкін.`}});
   }catch{report.stages.push({id:provider.id,version:'1',status:'failed',durationMs:Date.now()-started,evidenceIds:[],summary:{ru:'Поиск по истории сертификатов недоступен. Остальные источники сохранены.',kk:'Сертификаттар тарихынан іздеу қолжетімсіз. Басқа дереккөздер сақталды.'}});}
  }
  for(const host of [...seeds].slice(0,30))if(!report.candidates.some(c=>c.hostname===host))report.candidates.push({hostname:host,status:'not_checked',evidenceIds:[]});
  const originals=evidence.filter(e=>e.text&&e.sourceUrl&&new URL(e.sourceUrl).hostname===report.hostname&&e.mime==='text/plain');
  let checked=0;
  for(const candidate of report.candidates.slice(0,this.limit)){
   if(signal.aborted)break;
   try{
    const response=await this.fetcher('https://'+candidate.hostname,1024*1024,2,signal);
    if(response.status!==200||!String(response.headers['content-type']).includes('text/html'))throw Error('PAGE_UNAVAILABLE');
    const raw=save({name:'candidate-'+candidate.hostname+'.html',mime:'text/html',bytes:response.body,sourceUrl:response.url},'detective-page@1');
    const text=htmlText(response.body.toString()).text.slice(0,40000);
    const derived=save({name:'candidate-'+candidate.hostname+'.txt',mime:'text/plain',bytes:Buffer.from(text),text,sourceUrl:response.url},'detective-text@1');
    candidate.evidenceIds.push(raw.id,derived.id);candidate.status='content_checked';checked++;
    for(const source of originals){
     const match=contentSignals(source.text!,text);const ids=[source.id,derived.id];
     if(match.emails.length)addRelation(candidate.hostname,'shared_contact',ids,match.emails.join(', '));
     if(match.bins.length)addRelation(candidate.hostname,'shared_business_id',ids,match.bins.join(', '));
     if(match.similarity>=0.75)addRelation(candidate.hostname,'similar_content',ids,Math.round(match.similarity*100)+'%');
    }
   }catch{candidate.status='unavailable';}
  }
  report.stages.push({id:'candidate-content',version:'1',status:'partial',durationMs:Date.now()-started,evidenceIds:report.candidates.flatMap(c=>c.evidenceIds),summary:{ru:`Изучено страниц кандидатов: ${checked}, лимит ${this.limit}, до 40 000 символов на страницу. Совпадения контактов, БИН и текста — основания для проверки, не доказательство общего владельца. Поиск ограничен источниками и бюджетом.`,kk:`Үміткер беттері зерттелді: ${checked}, шегі ${this.limit}, әр бетте 40 000 таңбаға дейін. Байланыс, БСН мен мәтін сәйкестігі ортақ иені дәлелдемейді. Іздеу дереккөздер мен бюджетпен шектелген.`}});
  report.status='partial';
 }
}
