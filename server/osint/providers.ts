import {Resolver} from 'node:dns/promises';
import {connect} from 'node:tls';
import {isIP} from 'node:net';
import {safeFetch,resolvePublic} from '../network.ts';
import type {CollectorResult,DomainCollector,DomainTarget,ObservationDraft} from './contracts.ts';

const jsonArtifact=(name:string,data:unknown,sourceUrl?:string)=>({name,mime:'application/json',bytes:Buffer.from(JSON.stringify(data,null,2)),sourceUrl});
export class DnsCollector implements DomainCollector {
 readonly id='dns';readonly version='1.0.0';
 async collect(target:DomainTarget,signal:AbortSignal):Promise<CollectorResult>{
  const resolver=new Resolver({timeout:2500,tries:1});
  const cancel=()=>resolver.cancel();signal.addEventListener('abort',cancel,{once:true});
  const types=['A','AAAA','CNAME','NS','MX','TXT'] as const;
  try {
   signal.throwIfAborted();
   const records=await Promise.all(types.map(async type=>{
    try{return {type,status:'observed',values:await resolver.resolve(target.hostname,type)};}
    catch(error){const code=(error as NodeJS.ErrnoException).code;return {type,status:['ENODATA','ENOTFOUND'].includes(code||'')?'not_found':'unavailable',values:[]};}
   }));
   const partial=records.some(r=>r.status==='unavailable');
   return {status:partial?'partial':'completed',
    summary:{ru:'DNS — техническая инфраструктура на момент запроса; общий IP/NS не доказывает общего владельца.',kk:'DNS — сұрау сәтіндегі техникалық инфрақұрылым; ортақ IP/NS ортақ иені дәлелдемейді.'},
    artifacts:[jsonArtifact('dns.json',{hostname:target.hostname,queriedAt:new Date().toISOString(),records})],
    observations:records.filter(r=>Array.isArray(r.values)&&r.values.length).map(r=>({artifact:0,kind:'dns_'+r.type,value:JSON.stringify(r.values),status:'observed'})),
   };
  } finally {signal.removeEventListener('abort',cancel);}
 }
}
export function rdapObservations(data:unknown):ObservationDraft[]{
 const d=data as {entities?:any[];events?:{eventAction:string;eventDate:string}[]};
 const out:ObservationDraft[]=[];
 for(const entity of (d.entities||[]).slice(0,50)){
  const cards=Array.isArray(entity.vcardArray?.[1])?entity.vcardArray[1]:[];
  const field=(key:string)=>cards.find((f:any[])=>f[0]===key)?.[3];
  const roles=Array.isArray(entity.roles)?entity.roles:[];
  const name=roles.includes('registrar')?field('fn'):field('org');
  const value=Array.isArray(name)?name.join(' '):name;
  if(typeof value==='string'&&value.trim()&&(roles.includes('registrar')||roles.includes('registrant'))){
   out.push({artifact:0,kind:roles.includes('registrar')?'registrar':'registrant_organization',value:value.slice(0,1000),status:'observed'});
  }
 }
 for(const e of (d.events||[]).slice(0,20)){
  if(['registration','expiration','last changed'].includes(e.eventAction)&&typeof e.eventDate==='string')out.push({artifact:0,kind:e.eventAction,value:e.eventDate,status:'observed'});
 }
 return out;
}
export class RdapCollector implements DomainCollector {
 readonly id='rdap';readonly version='1.0.0';
 async collect(target:DomainTarget,signal:AbortSignal):Promise<CollectorResult>{
  const skip=(ru:string,kk:string):CollectorResult=>({status:'skipped',summary:{ru,kk},artifacts:[],observations:[]});
  if(!target.registrationDomain)return skip('Регистрируемый домен не определён.','Тіркелетін домен анықталмады.');
  const bootstrap=await safeFetch('https://data.iana.org/rdap/dns.json',2*1024*1024,3,signal);
  if(bootstrap.status!==200)throw new Error('RDAP_BOOTSTRAP_UNAVAILABLE');
  const services=JSON.parse(bootstrap.body.toString()).services as [string[],string[]][];
  if(!Array.isArray(services))throw new Error('INVALID_RDAP_BOOTSTRAP');
  const tld=target.registrationDomain.split('.').at(-1)!;
  const base=services.find(([zones])=>Array.isArray(zones)&&zones.includes(tld))?.[1]?.find(u=>typeof u==='string'&&u.startsWith('https://'));
  if(!base)return skip('В IANA нет RDAP-сервиса для этой зоны; владелец не установлен.','IANA-да бұл аймақтың RDAP сервисі жоқ; иесі анықталмады.');
  const url=base.replace(/\/$/,'')+'/domain/'+encodeURIComponent(target.registrationDomain);
  const response=await safeFetch(url,2*1024*1024,3,signal);
  if(response.status!==200)throw new Error('RDAP_UNAVAILABLE');
  const data=JSON.parse(response.body.toString());
  if(typeof data.ldhName!=='string'||data.ldhName.toLowerCase()!==target.registrationDomain)throw new Error('RDAP_DOMAIN_MISMATCH');
  return {status:'completed',
   summary:{ru:'Публичный ответ RDAP сохранён. Скрытые данные не восстанавливаются; регистратор не является оператором сайта.',kk:'Ашық RDAP жауабы сақталды. Жасырын деректер қалпына келтірілмейді; тіркеуші сайт операторы емес.'},
   artifacts:[{name:'rdap.json',mime:'application/json',bytes:response.body,sourceUrl:response.url},
     jsonArtifact('rdap-source.json',{domain:target.registrationDomain,bootstrapUrl:bootstrap.url,bootstrapPublication:JSON.parse(bootstrap.body.toString()).publication,service:base,queriedAt:new Date().toISOString()})],
   observations:rdapObservations(data)};
 }
}
export class TlsCollector implements DomainCollector {
 readonly id='tls';readonly version='1.0.0';
 async collect(target:DomainTarget,signal:AbortSignal):Promise<CollectorResult>{
  if(new URL(target.url).protocol!=='https:')return {status:'skipped',summary:{ru:'Исходный адрес использует HTTP; TLS не запрашивался.',kk:'Бастапқы мекенжай HTTP қолданады; TLS сұралмады.'},artifacts:[],observations:[]};
  const address=await resolvePublic(new URL(target.url));
  signal.throwIfAborted();
  const certificate=await new Promise<Record<string,unknown>>((resolve,reject)=>{
   const socket=connect({host:address.address,port:443,servername:isIP(target.hostname)?undefined:target.hostname,rejectUnauthorized:true});
   const abort=()=>socket.destroy(new Error('OSINT_CANCELLED'));
   signal.addEventListener('abort',abort,{once:true});
   const timer=setTimeout(()=>socket.destroy(new Error('TLS_TIMEOUT')),7000);
   socket.once('secureConnect',()=>{
    const cert=socket.getPeerCertificate();
    resolve({hostname:target.hostname,connectedAddress:address.address,subjectAltName:cert.subjectaltname,issuer:cert.issuer,validFrom:cert.valid_from,validTo:cert.valid_to,fingerprint256:cert.fingerprint256,certificatePem:cert.raw?'-----BEGIN CERTIFICATE-----\n'+cert.raw.toString('base64').match(/.{1,64}/g)!.join('\n')+'\n-----END CERTIFICATE-----':undefined});
    socket.destroy();
   });
   socket.once('error',reject);
   socket.once('close',()=>{clearTimeout(timer);signal.removeEventListener('abort',abort);});
   if(signal.aborted)abort();
  });
  return {status:'completed',summary:{ru:'Проверенный TLS-сертификат сервера сохранён. Имена сертификата не устанавливают владельца.',kk:'Сервердің тексерілген TLS сертификаты сақталды. Сертификат атаулары иені анықтамайды.'},
   artifacts:[jsonArtifact('tls.json',certificate,target.url)],
   observations:[
    {artifact:0,kind:'tls_names',value:String(certificate.subjectAltName||''),status:'observed'},
    {artifact:0,kind:'tls_issuer',value:JSON.stringify(certificate.issuer),status:'observed'},
    {artifact:0,kind:'tls_validity',value:String(certificate.validFrom)+' — '+String(certificate.validTo),status:'observed'},
   ]};
 }
}
