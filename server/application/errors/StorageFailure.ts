/** Port-level failure: processing may be retried without exposing database details. */
export class StorageFailure extends Error {
  constructor(cause: unknown) {
    super('STORAGE_UNAVAILABLE', { cause });
  }
}
