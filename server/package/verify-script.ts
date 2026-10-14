/** Standalone verifier included in exported archives; it has no application dependencies. */
export const verifyScript = `import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.dirname(fileURLToPath(import.meta.url));
const manifest = JSON.parse(readFileSync(path.join(root, 'manifest.json'), 'utf8'));
for (const file of manifest.files) {
  const location = path.resolve(root, file.path);
  if (!location.startsWith(root + path.sep)) throw new Error('Unsafe path');
  const bytes = readFileSync(location);
  const hash = createHash('sha256').update(bytes).digest('hex');
  if (bytes.length !== file.size || hash !== file.sha256) {
    throw new Error('Mismatch: ' + file.path);
  }
}
console.log('Verified ' + manifest.files.length + ' files. The manifest itself is not externally signed.');
`;
