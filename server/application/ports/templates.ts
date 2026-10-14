import type { Lang } from '../../../shared/types.ts';
export interface TemplateEntry {
  id: string;
  name: string;
  sha256: string;
}
export interface TemplateRepository {
  list(): TemplateEntry[];
  get(id: string): TemplateEntry | undefined;
  findByHash(hash: string): TemplateEntry | undefined;
  save(entry: TemplateEntry): void;
}
export interface TemplateValidator {
  validate(bytes: Buffer): void;
}
export interface BuiltinTemplate {
  raw(lang: Lang): Promise<Buffer>;
}
export interface TemplateCatalog {
  list(): TemplateEntry[];
  has(id: string): boolean;
  add(name: string, bytes: Buffer): TemplateEntry;
  raw(id: string, lang?: Lang): Promise<Buffer>;
}
