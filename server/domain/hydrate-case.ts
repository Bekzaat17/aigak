import type { CaseRecord } from '../../shared/types.ts';
export function hydrateCase(body: string): CaseRecord {
  const c = JSON.parse(body) as CaseRecord;
  c.analysisLevel ??= c.useAi ? 'advanced' : 'basic';
  return c;
}
