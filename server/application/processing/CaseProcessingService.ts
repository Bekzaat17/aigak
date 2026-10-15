import { StorageFailure } from '../errors/StorageFailure.ts';
import { busyStatuses } from '../../../shared/types.ts';
import type { CaseProcessor, ProcessingStage, ProcessingProgress } from '../ports/processing.ts';
import type { AuditWriter, CaseRepository } from '../ports/storage.ts';

/** Owns processing lifecycle; an ordered stage list supplies the actual work. */
export class CaseProcessingService implements CaseProcessor {
  constructor(
    private readonly store: Pick<CaseRepository, 'get' | 'all'> & AuditWriter,
    private readonly stages: readonly ProcessingStage[],
    private readonly progress?: ProcessingProgress,
    private readonly release?: (id: string) => Promise<void>,
  ) {
    if (new Set(stages.map((stage) => stage.id)).size !== stages.length)
      throw new Error('DUPLICATE_PROCESSING_STAGE');
  }

  async recoverInterrupted(): Promise<void> {
    for (const record of await this.store.all()) {
      if (!busyStatuses.includes(record.status)) continue;
      record.status = 'failed';
      record.step = {
        ru: 'Обработка прервана перезапуском',
        kk: 'Өңдеу қайта іске қосу кезінде үзілді',
      };
      record.issues.push(record.step);
      await this.store.event(record, 'processing.interrupted');
    }
  }

  async fail(id: string, code: string): Promise<void> {
    const record = await this.store.get(id);
    if (!record || !busyStatuses.includes(record.status)) return;
    record.status = 'failed';
    record.step = {
      ru: 'Обработка остановлена после повторных сбоев',
      kk: 'Қайталанған қателерден кейін өңдеу тоқтатылды',
    };
    record.issues.push(record.step);
    await this.store.event(record, 'processing.failed', code);
  }

  async run(id: string): Promise<void> {
    const record = await this.store.get(id);
    if (!record || !busyStatuses.includes(record.status)) return;
    try {
      const completed = new Set((await this.progress?.completedStages(id)) ?? []);
      for (const stage of this.stages) {
        if (completed.has(stage.id)) continue;
        await stage.execute(record);
        if (this.progress) {
          await this.store.event(record, 'processing.stage.completed', stage.id);
          await this.progress.checkpoint(id, stage.id);
        }
      }
      record.status = 'review';
      record.completedAt = new Date().toISOString();
      record.step = { ru: 'Ожидает проверки офицером', kk: 'Қызметкер тексеруін күтуде' };
      await this.store.event(
        record,
        'analysis.completed',
        `${record.findings.length} indicators; ${record.engine}`,
      );
    } catch (error) {
      if (
        error instanceof StorageFailure ||
        (error instanceof Error && error.message === 'CASE_CONFLICT')
      )
        throw error;
      record.status = 'failed';
      record.step = { ru: 'Не удалось завершить сбор', kk: 'Жинауды аяқтау мүмкін болмады' };
      const code = (error instanceof Error ? error.message : 'UNKNOWN').slice(0, 80);
      record.issues.push({
        ru: `Сбор остановлен (${code}). Уже полученные материалы сохранены.`,
        kk: `Жинау тоқтатылды (${code}). Алынған материалдар сақталды.`,
      });
      await this.store.event(record, 'processing.failed', code);
    } finally {
      await this.release?.(id);
    }
  }
}
