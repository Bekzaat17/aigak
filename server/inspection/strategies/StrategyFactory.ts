import type { AnalysisLevel } from '../../../shared/types.ts';
import type { InspectionStrategy } from '../contracts.ts';
import { AdvancedStrategy } from './AdvancedStrategy.ts';
import { BasicStrategy } from './BasicStrategy.ts';
import { ProStrategy } from './ProStrategy.ts';

/** Replace/register a whole strategy without changing callers or adding a switch to the queue. */
export class StrategyFactory {
  constructor(
    private readonly factories: Record<AnalysisLevel, () => InspectionStrategy> = {
      basic: () => new BasicStrategy(),
      advanced: () => new AdvancedStrategy(),
      pro: () => new ProStrategy(),
    },
  ) {}
  create(level: AnalysisLevel): InspectionStrategy {
    const factory = this.factories[level];
    if (!factory) throw new Error('UNKNOWN_ANALYSIS_LEVEL');
    return factory();
  }
}
