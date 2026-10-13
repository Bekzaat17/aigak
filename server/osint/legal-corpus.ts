import {load} from 'cheerio';
import {safeFetch} from '../network.ts';
import type {Localized} from '../../shared/types.ts';
import type {OsintReport} from '../../shared/osint.ts';
import type {SaveArtifact} from './contracts.ts';
export interface LegalSource {id:string;url:string;title:Localized;identity:string;articles:string[]}
export const legalCatalog:LegalSource[]=[
 {id:'Z030000508_',url:'https://old.adilet.zan.kz/rus/docs/Z030000508_',title:{ru:'О рекламе',kk:'Жарнама туралы'},identity:'19 декабря 2003 года',articles:['13']},
 {id:'K1400000226',url:'https://old.adilet.zan.kz/rus/docs/K1400000226',title:{ru:'Уголовный кодекс',kk:'Қылмыстық кодекс'},identity:'3 июля 2014 года',articles:['307']},
 {id:'K1400000235',url:'https://old.adilet.zan.kz/rus/docs/K1400000235',title:{ru:'КоАП',kk:'Әкімшілік құқық бұзушылық туралы кодекс'},identity:'5 июля 2014 года',articles:['445']},
 {id:'Z040000567_',url:'https://old.adilet.zan.kz/rus/docs/Z040000567_',title:{ru:'О связи',kk:'Байланыс туралы'},identity:'5 июля 2004 года',articles:['41-1']},
];
/** Extract whole articles; no generated legal wording or silently selected historical edition. */
export function parseLegalArticles(html:string,source:LegalSource){
 const $=load(html);$('script,style,nav').remove();
 if(!$('body').text().includes(source.identity))throw Error('LAW_IDENTITY_MISMATCH');
 const headings=$('h3,h4,h5,p').toArray().filter(n=>/^h[345]$/.test(n.tagName)||$(n).children('b,strong').length>0);
 return source.articles.map(article=>{
  const matches=headings.filter(h=>$(h).text().trim().startsWith(`Статья ${article}.`));
  if(matches.length!==1)throw Error('LAW_ARTICLE_AMBIGUOUS');
  const parts=[$(matches[0]).text().trim()];
  for(const node of $(matches[0]).nextAll().toArray()){
   const text=$(node).text().trim();
   if(/^Статья \d+[.-]/.test(text)&&(/^h[345]$/i.test(node.tagName)||$(node).children('b,strong').length>0))break;
   if(text)parts.push(text);
  }
  const quote=parts.join('\n');
  if(quote.length<100||quote.length>35000)throw Error('LAW_FORMAT_CHANGED');
  return {id:`KZ-${source.id}-article-${article}`,article,quote,title:source.title,documentId:source.id};
 });
}
export class LegalCorpusService {
 constructor(private fetcher:typeof safeFetch=safeFetch,private sources=legalCatalog){}
 async enrich(report:OsintReport,save:SaveArtifact){
  const results=await Promise.allSettled(this.sources.map(async source=>{
   const response=await this.fetcher(source.url,12*1024*1024,3,AbortSignal.timeout(25000));
   if(response.status!==200)throw Error('LAW_UNAVAILABLE');
   return {source,response,norms:parseLegalArticles(response.body.toString(),source)};
  }));
  for(let i=0;i<results.length;i++){
   const result=results[i],source=this.sources[i];
   if(result.status==='fulfilled'){
    const {response,norms}=result.value;
    const raw=save({name:source.id+'.html',mime:'text/html',bytes:response.body,sourceUrl:response.url},'official-corpus@1');
    report.legalNorms??=[];
    report.legalNorms.push(...norms.map(n=>({...n,evidenceId:raw.id,sourceUrl:response.url,retrievedAt:raw.createdAt,temporalStatus:'requires_review' as const})));
    report.stages.push({id:'law-'+source.id,version:'1',status:'partial',durationMs:0,evidenceIds:[raw.id],summary:{ru:`${source.title.ru}: статьи ${source.articles.join(', ')} сохранены. Редакцию и применимость на дату события проверяет инспектор.`,kk:`${source.title.kk}: ${source.articles.join(', ')} баптары сақталды. Оқиға күніндегі редакциясы мен қолданылуын инспектор тексереді.`}});
   }else report.stages.push({id:'law-'+source.id,version:'1',status:'failed',durationMs:0,evidenceIds:[],summary:{ru:`${source.title.ru}: официальный текст недоступен или формат не распознан.`,kk:`${source.title.kk}: ресми мәтін қолжетімсіз не пішімі танылмады.`}});
  }
 }
}
