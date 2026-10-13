import type { AnalysisLevel } from '../../shared/types.ts';
import type { InspectionStrategy } from './contracts.ts';

export class BasicStrategy implements InspectionStrategy {
  readonly level='basic'; readonly checks=['rules','integrity']; readonly maxAiCalls=0; readonly timeoutMs=10000;
}
export class AdvancedStrategy implements InspectionStrategy {
  readonly level='advanced'; readonly checks=['rules','context','mechanics','verification','integrity']; readonly maxAiCalls=3; readonly timeoutMs=210000;
}
export class ProStrategy implements InspectionStrategy {
  readonly level='pro';
  readonly checks=['rules','context','mechanics','verification','connections','legal','pro_review','integrity'];
  readonly maxAiCalls=5; readonly timeoutMs=330000;
}
/** Replace/register a whole strategy without changing callers or adding a switch to the queue. */
export class StrategyFactory {
  constructor(private readonly factories:Record<AnalysisLevel,()=>InspectionStrategy>={basic:()=>new BasicStrategy(),advanced:()=>new AdvancedStrategy(),pro:()=>new ProStrategy()}){}
  create(level:AnalysisLevel):InspectionStrategy {
    const factory=this.factories[level];if(!factory)throw new Error('UNKNOWN_ANALYSIS_LEVEL');
    return factory();
  }
}
