import { mkdirSync } from 'node:fs';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { AuditLog } from '../application/storage/AuditLog.ts';
import { CaseIntegrityVerifier } from '../application/storage/CaseIntegrityVerifier.ts';
import { EvidenceService } from '../application/storage/EvidenceService.ts';
import { Store } from '../application/storage/Store.ts';
import { Templates } from '../application/templates/Templates.ts';
import { FileBlobStorage } from '../storage/FileBlobStorage.ts';
import { SqliteCaseRepository } from '../storage/SqliteCaseRepository.ts';
import { SqliteTemplateRepository } from '../storage/SqliteTemplateRepository.ts';
import { DocxTemplateValidator } from '../templates/DocxTemplateValidator.ts';
import { defaultTemplate } from '../templates/default-template.ts';

/** Owns the shared SQLite connection. Call close after all consumers have stopped. */
export function createLocalStorage(directory: string) {
  mkdirSync(directory, { recursive: true, mode: 0o700 });
  const db = new DatabaseSync(path.join(directory, 'aigak.sqlite'));
  try {
    db.exec('PRAGMA journal_mode=WAL');
    const repository = new SqliteCaseRepository(db);
    const audit = new AuditLog(repository);
    const evidence = new EvidenceService(
      new FileBlobStorage(path.join(directory, 'evidence')),
      audit,
    );
    const store = new Store(repository, audit, evidence, new CaseIntegrityVerifier(evidence));
    const templates = new Templates(
      new SqliteTemplateRepository(db),
      new FileBlobStorage(path.join(directory, 'templates')),
      new DocxTemplateValidator(),
      { raw: defaultTemplate },
    );
    return { store, templates, close: () => db.close() };
  } catch (error) {
    db.close();
    throw error;
  }
}
