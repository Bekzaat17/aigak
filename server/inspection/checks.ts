import { RULESET_VERSION } from '../rules/catalog.ts';
import { analyzeRules } from '../rules/engine.ts';
import type { Localized } from '../../shared/types.ts';
import type { CheckContext, CheckResult, InspectionCheck } from './contracts.ts';

export const rulesAssessment=(count:number):Localized=>count ? {
  ru:'Найдены текстовые признаки игорного предложения. Проверьте контекст: это может быть реклама, новость или учебный материал.',
  kk:'Ойын ұсынысының мәтіндік белгілері табылды. Мәнмәтінді тексеріңіз: бұл жарнама, жаңалық немесе оқу материалы болуы мүмкін.',
} : {
  ru:'Текстовые признаки не найдены. Проверьте полноту материалов: это не подтверждение законности ресурса.',
  kk:'Мәтіндік белгілер табылмады. Материалдардың толықтығын тексеріңіз: бұл ресурс заңдылығын растамайды.',
};
export class RulesCheck implements InspectionCheck {
  readonly id='rules'; readonly version=RULESET_VERSION;readonly name={ru:'Базовые признаки',kk:'Негізгі белгілер'};readonly requiresAi=false;
  async execute({evidence}:CheckContext):Promise<CheckResult>{
    const findings=analyzeRules(evidence);
    const extracted=evidence.filter(e=>e.text?.trim()).length;
    const combinations=findings.filter(f=>f.rule?.kind==='combination').length;
    const caveats=findings.filter(f=>f.rule?.contexts.length).length;
    const summary={
      ru:`Материалов с текстом: ${extracted}. Наблюдений: ${findings.length}; сочетаний: ${combinations}; с контекстными оговорками: ${caveats}. Показано до 3 совпадений каждого правила на уникальный текст. Сочетания ищутся в пределах 240 символов одного абзаца. Правила не устанавливают нарушение закона.`,
      kk:`Мәтіні бар материалдар: ${extracted}. Бақылаулар: ${findings.length}; үйлесімдер: ${combinations}; мәнмәтін ескертулері бар: ${caveats}. Бірегей мәтінге әр ереженің 3 сәйкестігіне дейін көрсетіледі. Үйлесімдер бір абзацтың 240 таңбасы ішінде ізделеді. Ережелер заң бұзушылықты анықтамайды.`,
    };
    return {status:extracted?'completed':'skipped',findings,summary,assessment:rulesAssessment(findings.length)};
  }
}
export class AdvancedCheck implements InspectionCheck {
  readonly version='2.0.0';readonly requiresAi=true;
  constructor(readonly id:'context'|'mechanics'|'verification'|'pro_review',readonly name:Localized){}
  async execute(ctx:CheckContext):Promise<CheckResult>{
    const result=await ctx.analyze(this.id);
    return {status:'completed',findings:result.findings,summary:result.assessment,review:result.review,
      ...(['verification','pro_review'].includes(this.id)?{assessment:result.assessment,...(result.review&&['ambiguous','insufficient'].includes(result.review.status)?{}:{likelihood:result.likelihood}),replaceFindings:true}:{})};
  }
}
export class ConnectionsCheck implements InspectionCheck {
  readonly id='connections';readonly version='2.0.0';readonly name={ru:'Связи и внешние источники',kk:'Байланыстар және сыртқы дереккөздер'};readonly requiresAi=false;
  async execute(ctx:CheckContext):Promise<CheckResult>{const stage=ctx.osint?.stages.find(s=>s.id==='candidate-content')||ctx.osint?.stages.find(s=>s.id==='detective');if(stage)return {status:'partial',summary:stage.summary};return {status:'skipped',summary:{ru:`В материале ${ctx.links.length} ссылок для проверки. Внешний поисковый провайдер не подключён; связи и владельцы не установлены.`,kk:`Материалда тексеруге арналған ${ctx.links.length} сілтеме бар. Сыртқы іздеу провайдері қосылмаған; байланыстар мен иелер анықталмаған.`}};}
}
export class LegalCheck implements InspectionCheck {
  readonly id='legal';readonly version='2.0.0';readonly name={ru:'Правовые гипотезы',kk:'Құқықтық болжамдар'};readonly requiresAi=true;
  async execute(ctx:CheckContext):Promise<CheckResult>{if(ctx.osint?.legalNorms?.length){const result=await ctx.analyze('legal');return {status:'completed',summary:result.assessment,legalHypotheses:result.legalHypotheses};}return {status:'skipped',summary:{ru:'Проверенный корпус законодательства Казахстана не подключён. Статьи и квалификация не определены; требуется юридическая проверка.',kk:'Қазақстан заңнамасының тексерілген корпусы қосылмаған. Баптар мен саралау анықталмаған; құқықтық тексеру қажет.'}};}
}
export class EvidenceIntegrityCheck implements InspectionCheck {
  readonly id='integrity';readonly version='1.0.0';readonly name={ru:'Проверка связи цитат с материалами',kk:'Дәйексөздердің материалдармен байланысын тексеру'};readonly requiresAi=false;
  async execute(ctx:CheckContext):Promise<CheckResult>{
    for(const f of ctx.findings){const e=ctx.evidence.find(e=>e.id===f.evidenceId);if(!f.quote||!e?.text||e.text.slice(f.start,f.end)!==f.quote)throw new Error('UNGROUNDED_FINDING');}
    return {status:'completed',summary:{ru:`Проверены точные цитаты: ${ctx.findings.length}. Это не проверка достоверности самого источника.`,kk:`Нақты дәйексөздер тексерілді: ${ctx.findings.length}. Бұл дереккөздің өзінің дұрыстығын тексеру емес.`}};
  }
}
