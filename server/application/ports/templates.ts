import type { Lang } from '../../../shared/types.ts';
export interface TemplateEntry {
  id: string;
  name: string;
  sha256: string;
}
export interface TemplateRepository {
  list(): Promise<TemplateEntry[]>;
  get(id: string): Promise<TemplateEntry | undefined>;
  findByHash(hash: string): Promise<TemplateEntry | undefined>;
  save(entry: TemplateEntry): Promise<void>;
}
export interface TemplateValidator {
  validate(bytes: Buffer): void;
}
export interface BuiltinTemplate {
  raw(lang: Lang): Promise<Buffer>;
}
export interface TemplateCatalog {
  list(): Promise<TemplateEntry[]>;
  has(id: string): Promise<boolean>;
  add(name: string, bytes: Buffer): Promise<TemplateEntry>;
  raw(id: string, lang?: Lang): Promise<Buffer>;
}
