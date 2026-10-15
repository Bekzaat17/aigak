import type { AuthProfileCatalog } from '../application/ports/authentication';
import type multer from 'multer';
import type { CaseDocuments } from '../application/ports/documents.ts';
import type { JobQueue } from '../application/ports/processing.ts';
import type { CaseStore } from '../application/ports/storage.ts';
import type { TemplateCatalog } from '../application/ports/templates.ts';

export interface HttpDependencies {
  authProfiles?: AuthProfileCatalog;
  store: CaseStore;
  documents: CaseDocuments;
  queue: JobQueue;
  templates: TemplateCatalog;
  aiAnalyzer: { readonly available: boolean };
  upload: multer.Multer;
}
