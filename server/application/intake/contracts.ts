import type { JobQueue } from '../ports/processing.ts';
import type { CaseStore } from '../ports/storage.ts';
import type { TemplateCatalog } from '../ports/templates.ts';

export interface UploadedFile {
  name: string;
  buffer: Buffer;
}

export interface IntakeDependencies {
  store: CaseStore;
  queue: JobQueue;
  templates: Pick<TemplateCatalog, 'has'>;
}
