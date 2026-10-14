import { mkdirSync } from 'node:fs';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { SqliteCaseRepository } from '../storage/SqliteCaseRepository.ts';
import { SqliteTemplateRepository } from '../storage/SqliteTemplateRepository.ts';
import { composeStorage } from './compose-storage.ts';

/** SQLite compatibility adapter for tests and migration validation. */
export function createLocalStorage(directory: string) {
  mkdirSync(directory, { recursive: true, mode: 0o700 });
  const db = new DatabaseSync(path.join(directory, 'aigak.sqlite'));
  try {
    db.exec('PRAGMA journal_mode=WAL');
    return {
      ...composeStorage(directory, new SqliteCaseRepository(db), new SqliteTemplateRepository(db)),
      close: () => db.close(),
    };
  } catch (error) {
    db.close();
    throw error;
  }
}
