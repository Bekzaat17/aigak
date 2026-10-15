import { createPostgresStorage } from '../server/bootstrap/create-postgres-storage';
import { reverifyCaseEvidence } from '../server/application/reverify-case-evidence';
import { BrowserFindingVerifier } from '../server/collection/BrowserFindingVerifier';
import { openPatchrightSession } from '../server/collection/browser/open-patchright-session';

const ids = process.argv.slice(2);
if (!ids.length || !process.env.DATABASE_URL) throw Error('CASE_IDS_AND_DATABASE_REQUIRED');
// Worker lease prevents overlap with processing; stop the worker before this command.
const storage = await createPostgresStorage(
  process.env.DATA_DIR || 'data',
  process.env.DATABASE_URL,
  'worker',
);
try {
  const verifier = new BrowserFindingVerifier(storage.store, (_record, signal, viewport) =>
    openPatchrightSession(signal, viewport),
  );
  for (const id of ids) {
    const c = await reverifyCaseEvidence(id, storage.store, verifier);
    console.log(
      c.number,
      c.findings.filter((f) => f.visualEvidence?.status === 'verified').length,
      '/',
      c.findings.length,
    );
  }
} finally {
  await storage.close();
}
