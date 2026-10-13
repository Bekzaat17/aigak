import type { InspectionStrategy } from '../contracts.ts';

export class ProStrategy implements InspectionStrategy {
  readonly level = 'pro';
  readonly checks = [
    'rules',
    'context',
    'mechanics',
    'verification',
    'connections',
    'legal',
    'pro_review',
    'integrity',
  ];
  readonly maxAiCalls = 5;
  readonly timeoutMs = 330000;
}
