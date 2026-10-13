import {displayObservations} from './osint-presentation.ts';
import type {Localized} from './types.ts';
export interface OsintObservation {
  id:string; kind:string; value:string; evidenceId:string; sourceUrl?:string;
  collectedAt:string; collector:string; status:'observed'|'claimed'|'masked';
  quote?:string; start?:number; end?:number;
}
export interface OsintStage {
  id:string; version:string; status:'completed'|'partial'|'skipped'|'failed';
  summary:Localized; evidenceIds:string[]; durationMs:number;
}
export interface ResourceRelation {
 id:string; from:string; to:string; kind:"certificate_contains"|"links_to"|"resolves_to"|"ct_contains"|"shared_contact"|"shared_business_id"|"similar_content";
 evidenceIds:string[]; decision?:"pending"|"accepted"|"rejected";note?:string;description?:string; status:"observed"; checkedAt:string;
}
export interface DomainCandidate {hostname:string;status:"not_checked"|"dns_checked"|"content_checked"|"unavailable";evidenceIds:string[]}
export interface LegalNorm {title?:Localized;documentId?:string;id:string;article:string;quote:string;evidenceId:string;sourceUrl:string;retrievedAt:string;temporalStatus:"requires_review"}
export interface OsintReport {
  legalNorms?:LegalNorm[];
  registry?:{sourceDate:string;evidenceId:string;matches:{row:number;bin:string;organization:string;license:string;website:string;matchedBy:string[]}[]};
  relations?:ResourceRelation[]; candidates?:DomainCandidate[];
  version:string; status:'completed'|'partial'; stages:OsintStage[];
  observations:OsintObservation[];
  requestedUrl?:string; finalUrl?:string; hostname?:string; unicodeHostname?:string;
  registrationDomain?:string; siteDomain?:string;
}
export const osintLabels:Record<string,Localized>={
 dns_A:{ru:'IP-адреса IPv4',kk:'IPv4 мекенжайлары'},dns_AAAA:{ru:'IP-адреса IPv6',kk:'IPv6 мекенжайлары'},
 dns_NS:{ru:'DNS-серверы',kk:'DNS серверлері'},dns_MX:{ru:'Почтовые серверы',kk:'Пошта серверлері'},
 dns_CNAME:{ru:'Псевдонимы домена',kk:'Домен бүркеншік аттары'},dns_TXT:{ru:'Текстовые записи DNS',kk:'DNS мәтіндік жазбалары'},
 registry_match:{ru:'Совпадение в снимке реестра',kk:'Тізілім көшірмесіндегі сәйкестік'},
 email:{ru:'Опубликованный email',kk:'Жарияланған email'},
 phone:{ru:'Опубликованный телефон',kk:'Жарияланған телефон'},
 business_id:{ru:'Заявленный БИН',kk:'Көрсетілген БСН'},
 sensitive_identifier:{ru:'Персональный идентификатор скрыт',kk:'Жеке идентификатор жасырылған'},
 organization:{ru:'Заявленная организация',kk:'Көрсетілген ұйым'},
 address:{ru:'Опубликованный адрес',kk:'Жарияланған мекенжай'},
 license:{ru:'Заявленная лицензия',kk:'Көрсетілген лицензия'},
 social:{ru:'Публичный канал',kk:'Ашық арна'},
 registrar:{ru:'Регистратор',kk:'Тіркеуші'},
 registrant_organization:{ru:'Организация-регистрант по RDAP',kk:'RDAP бойынша тіркелуші ұйым'},
 registration:{ru:'Дата регистрации',kk:'Тіркелген күні'},
 expiration:{ru:'Дата истечения',kk:'Аяқталу күні'},
 'last changed':{ru:'Изменение регистрации',kk:'Тіркеудің өзгеруі'},
 tls_names:{ru:'Имена TLS-сертификата',kk:'TLS сертификатының атаулары'},
 tls_issuer:{ru:'Издатель сертификата',kk:'Сертификат беруші'},
 tls_validity:{ru:'Срок сертификата',kk:'Сертификат мерзімі'},
};
export function maskPersonalIds(text:string){
 return text.replace(/((?:ИИН|ЖСН|IIN)[ \t]*[:№-]?[ \t]*)(\d[\d \t-]{10,20}\d)/giu,(_all,label,value)=>{
   return value.replace(/\D/g,'').length===12?label+'[скрыто / жасырылған]':label+value;
 });
}
export function osintSummary(report:OsintReport,lang:'ru'|'kk'){
 return [
  (lang==='ru'?'Паспорт ресурса: ':'Ресурс паспорты: ')+(report.hostname||'—'),
  ...report.stages.map(s=>s.id+': '+s.status+' — '+s.summary[lang]),
  ...(report.legalNorms||[]).map(n=>(n.title?.[lang]||n.id)+' · '+n.article+' ['+n.evidenceId+'] '+n.sourceUrl),
  ...(report.relations||[]).map(r=>r.from+' → '+r.to+' ('+r.kind+') ['+r.evidenceIds.join(', ')+']'),
  ...(report.candidates||[]).map(c=>c.hostname+': '+c.status),
  ...displayObservations(report.observations,lang).map(o=>(osintLabels[o.kind]?.[lang]||o.kind)+': '+o.lines.join('; ')+' ['+o.sources.map(s=>s.evidenceId).join(', ')+']'),
 ].join('\n');
}
