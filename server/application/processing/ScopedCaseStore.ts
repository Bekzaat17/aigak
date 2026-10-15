import type { CaseStore, EvidenceInput } from '../ports/storage';
import type { CaseRecord, Evidence } from '../../../shared/types';
import type { StageScope } from '../ports/execution';

/** Late asynchronous callbacks may not publish after their stage was cancelled. */
export class ScopedCaseStore implements CaseStore, StageScope {
  private readonly scopes = new WeakMap<
    CaseRecord,
    { signal: AbortSignal; pending: Set<Promise<unknown>> }
  >();
  constructor(private readonly store: CaseStore) {}
  begin(record: CaseRecord, signal: AbortSignal) {
    this.scopes.set(record, { signal, pending: new Set() });
  }
  async drain(record: CaseRecord) {
    await Promise.allSettled([...(this.scopes.get(record)?.pending || [])]);
  }
  private async write<T>(record: CaseRecord, action: () => Promise<T>): Promise<T> {
    const scope = this.scopes.get(record);
    scope?.signal.throwIfAborted();
    const pending = action();
    scope?.pending.add(pending);
    try {
      return await pending;
    } finally {
      scope?.pending.delete(pending);
    }
  }
  nextNumber(year: number) {
    return this.store.nextNumber(year);
  }
  all() {
    return this.store.all();
  }
  list() {
    return this.store.list();
  }
  get(id: string) {
    return this.store.get(id);
  }
  save(c: CaseRecord) {
    return this.write(c, () => this.store.save(c));
  }
  event(c: CaseRecord, action: string, detail?: string) {
    return this.write(c, () => this.store.event(c, action, detail));
  }
  addEvidence(c: CaseRecord, bytes: Buffer, input: EvidenceInput) {
    return this.write(c, () => this.store.addEvidence(c, bytes, input));
  }
  read(c: CaseRecord, e: Evidence) {
    return this.store.read(c, e);
  }
  verify(c: CaseRecord) {
    return this.store.verify(c);
  }
}
