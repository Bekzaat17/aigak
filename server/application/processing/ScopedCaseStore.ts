import type { CaseStore, EvidenceInput } from '../ports/storage';
import type { CaseRecord, Evidence } from '../../../shared/types';
import type { StageScope } from '../ports/execution';

/** Late asynchronous callbacks may not publish after their stage was cancelled. */
export class ScopedCaseStore implements CaseStore, StageScope {
  private readonly scopes = new WeakMap<
    CaseRecord,
    { signal: AbortSignal; pending: Set<Promise<unknown>>; original: CaseRecord }
  >();
  constructor(private readonly store: CaseStore) {}
  begin(record: CaseRecord, signal: AbortSignal, original: CaseRecord) {
    this.scopes.set(record, { signal, pending: new Set(), original });
  }
  async drain(record: CaseRecord) {
    await Promise.allSettled([...(this.scopes.get(record)?.pending || [])]);
  }
  private async write<T>(
    record: CaseRecord,
    action: (target: CaseRecord) => Promise<T>,
  ): Promise<T> {
    const scope = this.scopes.get(record);
    scope?.signal.throwIfAborted();
    const target = scope?.original || record;
    if (scope) Object.assign(target, structuredClone(record));
    const pending = action(target);
    scope?.pending.add(pending);
    try {
      const result = await pending;
      if (scope) Object.assign(record, structuredClone(target));
      return result;
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
    return this.write(c, (target) => this.store.save(target));
  }
  event(c: CaseRecord, action: string, detail?: string) {
    return this.write(c, (target) => this.store.event(target, action, detail));
  }
  addEvidence(c: CaseRecord, bytes: Buffer, input: EvidenceInput) {
    return this.write(c, (target) => this.store.addEvidence(target, bytes, input));
  }
  read(c: CaseRecord, e: Evidence) {
    return this.store.read(c, e);
  }
  verify(c: CaseRecord) {
    return this.store.verify(c);
  }
}
