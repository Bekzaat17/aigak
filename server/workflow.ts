import { OfficialSourcesService } from './osint/official.ts';
import { DetectiveService } from './osint/detective.ts';
import { createOsintFacade } from './osint/index.ts';
import type { OsintFacade } from './osint/facade.ts';
import { collectContactPages } from './osint/site-pages.ts';
import { randomUUID } from 'node:crypto';
import type { CaseRecord, Decision } from '../shared/types.ts';
import { busyStatuses } from '../shared/types.ts';
import { Store } from './store.ts';
import { collectUrl, extractFile } from './collector.ts';
import { createInspectionFacade } from './inspection/index.ts';
import type { InspectionFacade } from './inspection/facade.ts';
import type { AnalysisLevel } from '../shared/types.ts';

export function newCase(store:Store,input:{title:string;sourceType:CaseRecord['sourceType'];sourceUrl?:string;useAi:boolean;analysisLevel?:AnalysisLevel;demo?:boolean;templateId?:string}):CaseRecord {
  const now=new Date().toISOString();
  const c:CaseRecord={...input,analysisLevel:input.analysisLevel||(input.useAi?'advanced':'basic'),templateId:input.templateId||'builtin',clarifications:[],likelihood:null,assessment:{ru:'',kk:''},demo:!!input.demo,id:randomUUID(),number:`AG-${new Date().getFullYear()}-${String(store.all().length+1).padStart(4,'0')}`,createdAt:now,updatedAt:now,status:'queued',step:{ru:'В очереди',kk:'Кезекте'},engine:'rules',evidence:[],findings:[],issues:[],links:[],redirects:[],officer:'',notes:'',audit:[]};
  c.useAi=c.analysisLevel!=='basic';
  c.clarifications=[{id:'source',question:{ru:'Происхождение материала и его связь с проверяемым ресурсом подтверждены?',kk:'Материалдың шығу тегі мен тексерілетін ресурсқа қатысы расталды ма?'},answer:'',note:''},{id:'context',question:{ru:'Это предложение или реклама азартной игры, а не новость, критика или учебный пример?',kk:'Бұл жаңалық, сын немесе оқу мысалы емес, құмар ойын ұсынысы не жарнамасы ма?'},answer:'',note:''}];
  c.likelihood=null;c.assessment={ru:'Оценка будет сформирована после анализа.',kk:'Баға талдаудан кейін қалыптасады.'};
  store.event(c,'case.created',input.demo?'synthetic demo':'local intake');return c;
}
export function reviewFinding(store:Store,c:CaseRecord,id:string,decision:Decision,note='') {
  if(busyStatuses.includes(c.status)) throw new Error('CASE_BUSY');
  const f=c.findings.find(f=>f.id===id);if(!f) throw new Error('NOT_FOUND');
  f.decision=decision;f.note=note;c.status='review';delete c.reviewedAt;
  store.event(c,'finding.reviewed',`${f.id}: ${decision}; ${note}`);
}
export function approveCase(store:Store,c:CaseRecord,officer:string,notes:string) {
  if(busyStatuses.includes(c.status)) throw new Error('CASE_BUSY');
  if(!officer.trim() || !c.findings.length || c.findings.some(f=>f.decision==='pending') || !c.findings.some(f=>f.decision==='accepted') || !notes.trim() || c.clarifications.some(q=>q.answer!=='yes')) throw new Error('REVIEW_INCOMPLETE');
  store.verify(c);c.officer=officer.trim();c.notes=notes.trim();c.reviewedAt=new Date().toISOString();c.status='verified';
  store.event(c,'case.reviewed',`${c.officer}: ${c.notes}`);
}
export class Queue {
  pending:string[]=[];running=false;
  constructor(private store:Store,private inspector:InspectionFacade=createInspectionFacade(),private osint:OsintFacade=createOsintFacade(),private detective=new DetectiveService(),private official=new OfficialSourcesService()) {
    for(const c of store.all()) if(busyStatuses.includes(c.status)) {c.status='failed';c.step={ru:'Обработка прервана перезапуском',kk:'Өңдеу қайта іске қосу кезінде үзілді'};c.issues.push(c.step);store.event(c,'processing.interrupted');}
  }
  add(id:string) {this.pending.push(id);void this.drain();}
  async drain() {
    if(this.running)return;this.running=true;
    try {while(this.pending.length) await this.run(this.pending.shift()!);} finally {this.running=false;}
  }
  async run(id:string) {
    const c=this.store.get(id);if(!c)return;
    try {
      c.status='collecting';c.step={ru:'Фиксация и извлечение текста',kk:'Тіркеу және мәтінді алу'};this.store.event(c,'collection.started');
      if(c.sourceType==='url') await collectUrl(this.store,c);
      else for(const e of [...c.evidence]) if(e.kind==='original') await extractFile(this.store,c,e);
      c.step={ru:'Паспорт ресурса и публичные реквизиты',kk:'Ресурс паспорты және ашық деректемелер'};this.store.event(c,'osint.started');
      const pageStage=await collectContactPages(this.store,c);
      c.osint=await this.osint.inspect({url:c.sourceUrl,finalUrl:c.evidence.find(e=>e.method==='playwright-dom')?.sourceUrl||c.redirects.at(-1)?.url,evidence:[...c.evidence]},
        (artifact,collector)=>this.store.addEvidence(c,artifact.bytes,{name:artifact.name,mime:artifact.mime,kind:'metadata',method:'osint-'+collector,sourceUrl:artifact.sourceUrl}));
      c.osint.stages.unshift(pageStage);
      if(pageStage.status==='partial')c.osint.status='partial';
      if(c.analysisLevel==='pro'){
        await this.official.enrich(c.osint,(a,collector)=>this.store.addEvidence(c,a.bytes,{name:a.name,mime:a.mime,kind:'metadata',method:collector,sourceUrl:a.sourceUrl}));
        c.step={ru:'Проверка технических связей',kk:'Техникалық байланыстарды тексеру'};
        const sources=c.evidence.map(e=>e.mime==='text/html'&&!e.method.startsWith('official-')?{...e,text:this.store.read(c,e).toString()}:e);
        await this.detective.investigate(c.osint,sources,(a,collector)=>this.store.addEvidence(c,a.bytes,{name:a.name,mime:a.mime,kind:'metadata',method:collector,sourceUrl:a.sourceUrl}));
      }
      this.store.event(c,'osint.completed',c.osint.status);
      c.status='analyzing';c.step={ru:'Поиск признаков и проверка цитат',kk:'Белгілерді іздеу және дәйексөздерді тексеру'};this.store.event(c,'analysis.started');
      const result=await this.inspector.inspect(c,stage=>{
        c.step=stage.name;
        this.store.event(c,'inspection.stage',`${stage.id}@${stage.version}: ${stage.status}`);
      });
      c.findings=result.findings;c.assessment=result.assessment;c.likelihood=result.likelihood;
      c.engine=result.engine;c.inspection=result.run;c.issues.push(...result.issues);
      c.status='review';c.completedAt=new Date().toISOString();c.step={ru:'Ожидает проверки офицером',kk:'Қызметкер тексеруін күтуде'};this.store.event(c,'analysis.completed',`${c.findings.length} indicators; ${c.engine}`);
    } catch(error) {
      c.status='failed';c.step={ru:'Не удалось завершить сбор',kk:'Жинауды аяқтау мүмкін болмады'};
      const code=error instanceof Error?error.message:'UNKNOWN';
      c.issues.push({ru:`Сбор остановлен (${code.slice(0,80)}). Уже полученные материалы сохранены.`,kk:`Жинау тоқтатылды (${code.slice(0,80)}). Алынған материалдар сақталды.`});this.store.event(c,'processing.failed',code.slice(0,80));
    }
  }
}
