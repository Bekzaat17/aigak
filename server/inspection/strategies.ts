import type { AnalysisLevel } from '../../shared/types.ts';
import type { InspectionStrategy } from './contracts.ts';

export class BasicStrategy implements InspectionStrategy {
  readonly level='basic'; readonly checks=['rules','integrity']; readonly maxAiCalls=0; readonly timeoutMs=10000;
}
export class AdvancedStrategy implements InspectionStrategy {
  readonly level='advanced'; readonly checks=['rules','context','integrity']; readonly maxAiCalls=1; readonly timeoutMs=70000;
}
export class ProStrategy implements InspectionStrategy {
  readonly level='pro';
  readonly checks=['rules','mechanics','promotion','payments','context','connections','legal','integrity'];
  readonly maxAiCalls=4; readonly timeoutMs=180000;
}
/** Replace/register a whole strategy without changing callers or adding a switch to the queue. */
export class StrategyFactory {
  constructor(private readonly factories:Record<AnalysisLevel,()=>InspectionStrategy>={basic:()=>new BasicStrategy(),advanced:()=>new AdvancedStrategy(),pro:()=>new ProStrategy()}){}
  create(level:AnalysisLevel):InspectionStrategy {
    const factory=this.factories[level];if(!factory)throw new Error('UNKNOWN_ANALYSIS_LEVEL');
    return factory();
  }
}
