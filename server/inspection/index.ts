import { CheckRegistry } from './CheckRegistry.ts';
import {
  AdvancedCheck,
  ConnectionsCheck,
  EvidenceIntegrityCheck,
  LegalCheck,
  RulesCheck,
} from './checks.ts';
import type { AiAnalyzer } from './contracts.ts';
import { InspectionFacade } from './InspectionFacade.ts';
import { createAiAnalyzer } from './provider.ts';
import { StrategyFactory } from './strategies.ts';

/** Composition root: dependency wiring is kept out of API routes and business workflow. */
export function createInspectionFacade(ai: AiAnalyzer = createAiAnalyzer()) {
  const registry = new CheckRegistry()
    .register('rules', () => new RulesCheck())
    .register(
      'context',
      () => new AdvancedCheck('context', { ru: 'Контекст материала', kk: 'Материал мәнмәтіні' }),
    )
    .register(
      'mechanics',
      () => new AdvancedCheck('mechanics', { ru: 'Механика предложения', kk: 'Ұсыныс механикасы' }),
    )
    .register(
      'verification',
      () =>
        new AdvancedCheck('verification', { ru: 'Проверка выводов', kk: 'Қорытындыларды тексеру' }),
    )
    .register('connections', () => new ConnectionsCheck())
    .register(
      'pro_review',
      () =>
        new AdvancedCheck('pro_review', {
          ru: 'Итоговая проверка расследования',
          kk: 'Тергеуді қорытынды тексеру',
        }),
    )
    .register('legal', () => new LegalCheck())
    .register('integrity', () => new EvidenceIntegrityCheck());
  return new InspectionFacade(registry, new StrategyFactory(), ai);
}
