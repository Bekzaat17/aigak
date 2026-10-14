/** Immutable binary objects. Writes must fail rather than overwrite an existing object. */
export interface BlobStorage {
  write(namespace: string, name: string, bytes: Buffer): void;
  read(namespace: string, name: string): Buffer;
}
