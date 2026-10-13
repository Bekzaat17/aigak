import { CheckRegistry } from './registry.ts';
import { StrategyFactory } from './strategies.ts';
import { InspectionFacade } from './facade.ts';
import { OpenAiAnalyzer } from './provider.ts';
import { RulesCheck, ContextCheck, SpecialistCheck, ConnectionsCheck, LegalCheck, EvidenceIntegrityCheck } from './checks.ts';
import type { AiAnalyzer } from './contracts.ts';

/** Composition root: dependency wiring is kept out of API routes and business workflow. */
export function createInspectionFacade(ai:AiAnalyzer=new OpenAiAnalyzer()){
  const registry=new CheckRegistry()
    .register('rules',()=>new RulesCheck())
    .register('mechanics',()=>new SpecialistCheck('mechanics',{ru:'Игровые механики',kk:'Ойын механикасы'},'Inspect only gambling mechanics, betting, stakes and winnings. Distinguish an actual offer from mere mentions.',['gambling','bet']))
    .register('promotion',()=>new SpecialistCheck('promotion',{ru:'Реклама и вовлечение',kk:'Жарнама және тарту'},'Inspect only incentives, bonuses, referral codes and invitations. Explain whether they actually relate to gambling.',['incentive']))
    .register('payments',()=>new SpecialistCheck('payments',{ru:'Денежные операции',kk:'Ақша операциялары'},'Inspect only deposits and withdrawals offered in relation to gambling. Never infer a completed transaction from advertising text.',['payment']))
    .register('context',()=>new ContextCheck())
    .register('connections',()=>new ConnectionsCheck())
    .register('legal',()=>new LegalCheck())
    .register('integrity',()=>new EvidenceIntegrityCheck());
  return new InspectionFacade(registry,new StrategyFactory(),ai);
}
