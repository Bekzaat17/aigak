import type { CaseRecord, Localized } from '../../../shared/types';

export interface PageRequest {
  url: string;
  purpose: Localized;
}
export interface PagePlanner {
  plan(record: CaseRecord): PageRequest[];
}
