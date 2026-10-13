import type { InspectionStrategy } from '../contracts.ts';

export class AdvancedStrategy implements InspectionStrategy {
  readonly level = 'advanced';
  readonly checks = ['rules', 'context', 'mechanics', 'verification', 'integrity'];
  readonly maxAiCalls = 3;
  readonly timeoutMs = 210000;
}
