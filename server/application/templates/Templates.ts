import { randomUUID } from 'node:crypto';
import type { Lang } from '../../../shared/types.ts';
import { sha256 } from '../../domain/sha256.ts';
import type { BlobStorage } from '../ports/blobs.ts';
import type {
  BuiltinTemplate,
  TemplateCatalog,
  TemplateRepository,
  TemplateValidator,
} from '../ports/templates.ts';

export class Templates implements TemplateCatalog {
  constructor(
    private repository: TemplateRepository,
    private blobs: BlobStorage,
    private validator: TemplateValidator,
    private builtin: BuiltinTemplate,
  ) {}
  list() {
    return [{ id: 'builtin', name: 'aigak · RU / KK', sha256: '' }, ...this.repository.list()];
  }
  has(id: string) {
    return id === 'builtin' || !!this.repository.get(id);
  }
  validate(data: Buffer) {
    this.validator.validate(data);
  }
  add(name: string, data: Buffer) {
    this.validator.validate(data);
    const id = randomUUID();
    const hash = sha256(data);
    const existing = this.repository.findByHash(hash);
    if (existing) return existing;
    const entry = { id, name, sha256: hash };
    this.blobs.write('', `${id}.docx`, data);
    this.repository.save({ ...entry, name: name.slice(0, 120) });
    return entry;
  }
  async raw(id: string, lang: Lang = 'ru') {
    if (id === 'builtin') return this.builtin.raw(lang);
    const entry = this.repository.get(id);
    if (!entry) throw new Error('NOT_FOUND');
    const data = this.blobs.read('', `${id}.docx`);
    if (sha256(data) !== entry.sha256) throw new Error('INTEGRITY_FAILED');
    return data;
  }
}
