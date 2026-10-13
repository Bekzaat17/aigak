import { busyStatuses } from '../../../shared/types.ts';
import type { CaseProcessor, ProcessingStage } from '../ports/processing.ts';
import type { AuditWriter, CaseRepository } from '../ports/storage.ts';

/** Owns processing lifecycle; an ordered stage list supplies the actual work. */
export class CaseProcessingService implements CaseProcessor {
  constructor(
    private readonly store: Pick<CaseRepository, 'get' | 'all'> & AuditWriter,
    private readonly stages: readonly ProcessingStage[],
  ) {}

  recoverInterrupted(): void {
    for (const record of this.store.all()) {
      if (!busyStatuses.includes(record.status)) continue;
      record.status = 'failed';
      record.step = {
        ru: 'Обработка прервана перезапуском',
        kk: 'Өңдеу қайта іске қосу кезінде үзілді',
      };
      record.issues.push(record.step);
      this.store.event(record, 'processing.interrupted');
    }
  }

  async run(id: string): Promise<void> {
    const record = this.store.get(id);
    if (!record) return;
    try {
      for (const stage of this.stages) await stage.execute(record);
      record.status = 'review';
      record.completedAt = new Date().toISOString();
      record.step = { ru: 'Ожидает проверки офицером', kk: 'Қызметкер тексеруін күтуде' };
      this.store.event(
        record,
        'analysis.completed',
        `${record.findings.length} indicators; ${record.engine}`,
      );
    } catch (error) {
      record.status = 'failed';
      record.step = { ru: 'Не удалось завершить сбор', kk: 'Жинауды аяқтау мүмкін болмады' };
      const code = (error instanceof Error ? error.message : 'UNKNOWN').slice(0, 80);
      record.issues.push({
        ru: `Сбор остановлен (${code}). Уже полученные материалы сохранены.`,
        kk: `Жинау тоқтатылды (${code}). Алынған материалдар сақталды.`,
      });
      this.store.event(record, 'processing.failed', code);
    }
  }
}
