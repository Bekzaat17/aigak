import type { CaseRecord } from '../../../shared/types';
import type { ProcessingStage } from '../ports/processing';
import type { ProcessingExecutionPolicy } from '../ports/execution';
import { StorageFailure } from '../errors/StorageFailure';

export async function executeScopedStage(
  stage: ProcessingStage,
  record: CaseRecord,
  policy: ProcessingExecutionPolicy,
  deadlineAt: number,
) {
  const budget = Math.max(
    1,
    Math.min(policy.stageBudgets[stage.id] || 20000, deadlineAt - Date.now()),
  );
  const controller = new AbortController();
  const working = structuredClone(record);
  policy.scope.begin(working, controller.signal);
  const start = Date.now();
  let status: 'completed' | 'failed' = 'completed';
  let reason: string | undefined;
  let timer: ReturnType<typeof setTimeout>;
  try {
    await Promise.race([
      stage.execute(working, { signal: controller.signal, deadlineAt: Date.now() + budget }),
      new Promise<never>((_, reject) => {
        timer = setTimeout(() => {
          controller.abort(Error('STAGE_DEADLINE'));
          reject(Error('STAGE_DEADLINE'));
        }, budget);
      }),
    ]);
  } catch (error) {
    if (
      error instanceof StorageFailure ||
      (error instanceof Error && error.message === 'CASE_CONFLICT')
    )
      throw error;
    status = 'failed';
    reason =
      error instanceof Error && /^[A-Z_]+$/.test(error.message) ? error.message : 'STAGE_FAILED';
  } finally {
    clearTimeout(timer!);
    controller.abort(Error('STAGE_CLOSED'));
    await policy.scope.drain(working);
    Object.assign(record, structuredClone(working));
  }
  record.scenarioRun?.actions.push({
    role: 'orchestrator',
    action: stage.id,
    status,
    reason,
    startedAt: new Date(start).toISOString(),
    durationMs: Date.now() - start,
  });
  if (status === 'failed') {
    record.scenarioRun!.status = 'partial';
    record.issues.push({
      ru: `Этап ${stage.id} не завершён (${reason}). Сохранён частичный результат.`,
      kk: `${stage.id} кезеңі аяқталмады (${reason}). Ішінара нәтиже сақталды.`,
    });
  }
  return status === 'completed';
}
