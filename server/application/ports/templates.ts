import type { Lang } from '../../../shared/types.ts';
export interface TemplateCatalog {
  list(): unknown[];
  has(id: string): boolean;
  add(name: string, bytes: Buffer): unknown;
  raw(id: string, lang?: Lang): Promise<Buffer>;
}
