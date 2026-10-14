import path from 'node:path';
import type { CaseRepository } from '../application/ports/storage.ts';
import type { TemplateRepository } from '../application/ports/templates.ts';
import { AuditLog } from '../application/storage/AuditLog.ts';
import { CaseIntegrityVerifier } from '../application/storage/CaseIntegrityVerifier.ts';
import { EvidenceService } from '../application/storage/EvidenceService.ts';
import { Store } from '../application/storage/Store.ts';
import { Templates } from '../application/templates/Templates.ts';
import { FileBlobStorage } from '../storage/FileBlobStorage.ts';
import { DocxTemplateValidator } from '../templates/DocxTemplateValidator.ts';
import { defaultTemplate } from '../templates/default-template.ts';

export function composeStorage(
  directory: string,
  repository: CaseRepository,
  templateRepository: TemplateRepository,
) {
  const audit = new AuditLog(repository);
  const evidence = new EvidenceService(
    new FileBlobStorage(path.join(directory, 'evidence')),
    audit,
  );
  return {
    store: new Store(repository, audit, evidence, new CaseIntegrityVerifier(evidence)),
    templates: new Templates(
      templateRepository,
      new FileBlobStorage(path.join(directory, 'templates')),
      new DocxTemplateValidator(),
      { raw: defaultTemplate },
    ),
  };
}
