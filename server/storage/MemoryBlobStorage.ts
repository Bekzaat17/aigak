import type { BlobStorage } from '../application/ports/blobs';
export class MemoryBlobStorage implements BlobStorage {
  private readonly objects = new Map<string, Buffer>();
  private bytes = 0;
  constructor(private readonly limit = 32 * 1024 * 1024) {}
  write(namespace: string, name: string, bytes: Buffer) {
    const key = namespace + '/' + name;
    if (this.objects.has(key)) throw Error('BLOB_ALREADY_EXISTS');
    if (this.bytes + bytes.length > this.limit) throw Error('ARTIFACT_BUDGET_EXCEEDED');
    this.bytes += bytes.length;
    this.objects.set(key, Buffer.from(bytes));
  }
  read(namespace: string, name: string) {
    const bytes = this.objects.get(namespace + '/' + name);
    if (!bytes) throw Error('BLOB_NOT_FOUND');
    return Buffer.from(bytes);
  }
}
