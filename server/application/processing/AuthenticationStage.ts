import type { CaseRecord } from '../../../shared/types';
import type { ProcessingStage } from '../ports/processing';
import type { ProcessingContext } from '../ports/execution';
import type { CaseStore } from '../ports/storage';
import { reviewCollectionAttempt } from '../../domain/review-collection-attempt';
export class AuthenticationStage implements ProcessingStage {
  readonly id = 'authentication-v1';
  constructor(
    private readonly store: Pick<CaseStore, 'event'>,
    private readonly access: { collect(record: CaseRecord, signal: AbortSignal): Promise<void> },
  ) {}
  async execute(c: CaseRecord, context?: ProcessingContext) {
    if (
      c.analysisLevel !== 'pro' ||
      !c.authenticationRequest ||
      (c.reanalysis && !c.refreshSources)
    )
      return;
    c.step = {
      ru: 'Проверка разрешённого доступа после входа',
      kk: 'Кіргеннен кейін рұқсат етілген қолжетімділікті тексеру',
    };
    await this.store.event(c, 'authentication.started');
    const started = Date.now();
    await this.access.collect(c, context?.signal || AbortSignal.timeout(90000));
    const ids = c.authentication?.evidenceIds || [];
    const reviewed = reviewCollectionAttempt(c.evidence.filter((e) => ids.includes(e.id)));
    c.collection?.attempts.push({
      method: 'authenticated-browser',
      startedAt: new Date(started).toISOString(),
      durationMs: Date.now() - started,
      ...reviewed,
      evidenceIds: ids,
    });
    if (reviewed.status === 'adequate' && c.collection) c.collection.status = 'adequate';
    if (c.authentication?.status !== 'authenticated' && c.scenarioRun)
      c.scenarioRun.status = 'partial';
    await this.store.event(c, 'authentication.completed', c.authentication?.status);
  }
}
