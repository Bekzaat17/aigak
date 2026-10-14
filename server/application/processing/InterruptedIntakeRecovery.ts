import type { AuditWriter, CaseRepository } from '../ports/storage.ts';

/** A previous API process may have died while uploading, before acknowledging a job. */
export class InterruptedIntakeRecovery {
  constructor(private readonly store: Pick<CaseRepository, 'get'> & AuditWriter) {}

  async recover(ids: readonly string[]): Promise<void> {
    for (const id of ids) {
      const record = await this.store.get(id);
      if (!record) continue;
      record.status = 'failed';
      record.step = {
        ru: 'Приём задания был прерван. Запустите повторный анализ.',
        kk: 'Тапсырманы қабылдау үзілді. Талдауды қайта іске қосыңыз.',
      };
      record.issues.push(record.step);
      await this.store.event(record, 'intake.interrupted');
    }
  }
}
