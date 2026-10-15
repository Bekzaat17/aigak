import type { ProcessingExecutionPolicy } from '../ports/execution';
import { executeScopedStage } from './execute-scoped-stage';
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
    private readonly execution?: ProcessingExecutionPolicy,
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
    const policy = record.analysisLevel === 'pro' ? this.execution : undefined;
    const resumed =
      policy && record.scenarioRun && !record.scenarioRun.completedAt
        ? record.scenarioRun
        : undefined;
    const deadlineAt = resumed
      ? Date.parse(resumed.deadlineAt)
      : Date.now() + (policy?.budgetMs || 400000);
    if (policy && !resumed)
      record.scenarioRun = {
        version: '1.0.0',
        startedAt: new Date().toISOString(),
        deadlineAt: new Date(deadlineAt).toISOString(),
        status: 'running',
        actions: [],
      };
    try {
      const completed = new Set((await this.progress?.completedStages(id)) ?? []);
      for (const stage of this.stages) {
        if (completed.has(stage.id)) continue;
        if (policy && Date.now() >= deadlineAt) {
          record.scenarioRun!.status = 'partial';
          record.issues.push({
            ru: 'Общий бюджет проверки исчерпан. Полученные материалы сохранены.',
            kk: 'Тексеру уақыты аяқталды. Алынған материалдар сақталды.',
          });
          break;
        }
        const succeeded = policy
          ? await executeScopedStage(stage, record, policy, deadlineAt)
          : (await stage.execute(record), true);
        if (!succeeded) {
          await this.store.event(record, 'processing.stage.partial', stage.id);
          continue;
        }
        if (this.progress) {
          await this.store.event(record, 'processing.stage.completed', stage.id);
          await this.progress.checkpoint(id, stage.id);
        }
      }
      if (record.scenarioRun) {
        record.scenarioRun.completedAt = new Date().toISOString();
        if (record.scenarioRun.status === 'running') record.scenarioRun.status = 'completed';
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
