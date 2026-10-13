import type { Finding, InspectionStage, Localized } from '../../shared/types.ts';
import type { AiAnalyzer, InspectionInput, InspectionResult, ProgressObserver, CheckResult } from './contracts.ts';
import { CheckRegistry } from './registry.ts';
import { StrategyFactory } from './strategies.ts';
import { rulesAssessment } from './checks.ts';

function validateFindings(findings:Finding[],input:InspectionInput){
  for(const f of findings){const e=input.evidence.find(e=>e.id===f.evidenceId);if(!f.quote||!e?.text||e.text.slice(f.start,f.end)!==f.quote)throw new Error('UNGROUNDED_FINDING');}
}
function mergeFindings(existing:Finding[],incoming:Finding[],agentId:string):Finding[]{
  const result=structuredClone(existing);
  for(const finding of incoming){
    const same=result.find(f=>f.evidenceId===finding.evidenceId&&f.category===finding.category&&f.quote===finding.quote&&f.rule?.id===finding.rule?.id);
    if(same)same.agentIds=[...new Set([...(same.agentIds||[]),agentId])];
    else result.push({...finding,decision:'pending',agentIds:[agentId]});
  }
  return result;
}
/** Facade owns execution, resource limits and validation; it knows no concrete check classes. */
export class InspectionFacade {
  constructor(private readonly registry:CheckRegistry,private readonly strategies:StrategyFactory,private readonly ai:AiAnalyzer){}
  async inspect(input:InspectionInput,onStage:ProgressObserver=()=>{}):Promise<InspectionResult>{
    const strategy=this.strategies.create(input.analysisLevel);
    // Resolve all configuration up front: unknown plugins are deployment errors, not partial success.
    const checks=strategy.checks.map(id=>this.registry.create(id));
    const startedAt=new Date().toISOString();const controller=new AbortController();
    const timer=setTimeout(()=>controller.abort(new Error('ANALYSIS_TIMEOUT')),strategy.timeoutMs);
    const stages:InspectionStage[]=[];const issues:Localized[]=[];let findings:Finding[]=[];
    let likelihood:number|null=null;let assessment=rulesAssessment(0);let aiCalls=0;let successfulAi=0;
    const hasText=input.evidence.some(e=>e.text?.trim());
    try {
      for(const check of checks){
        const start=Date.now();let result:CheckResult|undefined;let errorCode:string|undefined;
        try {
          if(controller.signal.aborted)throw new Error('ANALYSIS_TIMEOUT');
          if(check.requiresAi&&!hasText) result={status:'skipped',summary:{ru:'Нет извлечённого текста для AI-проверки.',kk:'AI тексеруі үшін алынған мәтін жоқ.'}};
          else if(check.requiresAi&&!this.ai.available) result={status:'skipped',summary:{ru:'AI не подключён. Этот этап не выполнен.',kk:'AI қосылмаған. Бұл кезең орындалмады.'}};
          else {
            const context={
              evidence:structuredClone(input.evidence),findings:structuredClone(findings),links:[...input.links],signal:controller.signal,
              analyze:async(focus:string)=>{
                if(!check.requiresAi||aiCalls>=strategy.maxAiCalls)throw new Error('AI_BUDGET_EXCEEDED');
                controller.signal.throwIfAborted();aiCalls++;
                return this.ai.analyze(structuredClone(input.evidence),{focus,signal:controller.signal});
              },
            };
            // Enforce the run deadline even for custom providers that ignore cancellation.
            let abortListener:()=>void=()=>{};
            try {
              result=await Promise.race([check.execute(context),new Promise<never>((_,reject)=>{
                abortListener=()=>reject(new Error('ANALYSIS_TIMEOUT'));
                controller.signal.addEventListener('abort',abortListener,{once:true});
                if(controller.signal.aborted)abortListener();
              })]);
            } finally {controller.signal.removeEventListener('abort',abortListener);}
            validateFindings(result.findings||[],input);
            if(result.likelihood!==undefined&&(!Number.isFinite(result.likelihood)||result.likelihood<0||result.likelihood>100))throw new Error('INVALID_LIKELIHOOD');
            if(result.status==='completed'){
              findings=mergeFindings(result.replaceFindings?[]:findings,result.findings||[],check.id);
              if(result.assessment)assessment=result.assessment;
              if(result.likelihood!==undefined)likelihood=result.likelihood;
              if(check.requiresAi)successfulAi++;
            }
          }
        } catch(e){errorCode=e instanceof Error&&/^[A-Z_]+$/.test(e.message)?e.message:'CHECK_FAILED';}
        const status=errorCode?'failed':result!.status;
        const summary=errorCode?{ru:`Этап не выполнен (${errorCode}). Остальные материалы сохранены.`,kk:`Кезең орындалмады (${errorCode}). Қалған материалдар сақталды.`}:result!.summary;
        const stage:InspectionStage={id:check.id,version:check.version,name:check.name,status,startedAt:new Date(start).toISOString(),durationMs:Date.now()-start,summary,observations:status==='completed'?structuredClone(result?.findings||[]):[],findingIds:status==='completed'?(result?.findings||[]).map(f=>f.id):[],...(errorCode?{errorCode}:{})};
        stages.push(stage);if(status!=='completed')issues.push({ru:`${check.name.ru}: ${summary.ru}`,kk:`${check.name.kk}: ${summary.kk}`});
        onStage(structuredClone(stage));
      }
    } finally {clearTimeout(timer);}
    if(!hasText)issues.push({ru:'Недостаточно извлечённого текста для анализа.',kk:'Талдау үшін алынған мәтін жеткіліксіз.'});
    // A partial run must not look like a confident, completed investigation.
    const partial=stages.some(s=>s.status!=='completed')||!hasText;
    if(partial)likelihood=null;
    return {findings,assessment,likelihood,engine:successfulAi?'ai':'rules',issues,run:{level:strategy.level,version:'1.0.0',status:partial?'partial':'completed',startedAt,completedAt:new Date().toISOString(),aiCalls,stages}};
  }
}
