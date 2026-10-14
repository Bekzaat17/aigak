import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import type { BlobStorage } from '../application/ports/blobs.ts';

export class FileBlobStorage implements BlobStorage {
  constructor(private directory: string) {
    mkdirSync(directory, { recursive: true, mode: 0o700 });
  }
  write(namespace: string, name: string, bytes: Buffer): void {
    const folder = path.join(this.directory, namespace);
    mkdirSync(folder, { recursive: true, mode: 0o700 });
    writeFileSync(path.join(folder, name), bytes, { flag: 'wx', mode: 0o400 });
  }
  read(namespace: string, name: string): Buffer {
    return readFileSync(path.join(this.directory, namespace, name));
  }
}
