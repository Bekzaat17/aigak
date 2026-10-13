import type { InspectionStrategy } from '../contracts.ts';

export class BasicStrategy implements InspectionStrategy {
  readonly level = 'basic';
  readonly checks = ['rules', 'integrity'];
  readonly maxAiCalls = 0;
  readonly timeoutMs = 10000;
}
