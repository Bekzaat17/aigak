import type { CaseRecord } from '../../../shared/types.ts';
import type { ProcessingStage } from '../ports/processing.ts';
import type { CaseStore } from '../ports/storage.ts';

export class FindingVerificationStage implements ProcessingStage {
  readonly id = 'finding-verification-v1';
  constructor(
    private readonly store: Pick<CaseStore, 'event'>,
    private readonly verifier: { verify(record: CaseRecord, signal?: AbortSignal): Promise<void> },
  ) {}
  async execute(record: CaseRecord, context?: import('../ports/execution').ProcessingContext) {
    record.step = {
      ru: 'Сверка цитат и снимков находок',
      kk: 'Дәйексөздер мен белгі суреттерін салыстыру',
    };
    await this.store.event(record, 'visual-verification.started');
    await this.verifier.verify(record, context?.signal);
    const verified = record.findings.filter((f) => f.visualEvidence?.status === 'verified').length;
    if (record.sourceType === 'url' && verified < record.findings.length)
      record.issues.push({
        ru: `Визуальное подтверждение: ${verified}/${record.findings.length}. Для остальных находок точная цитата на доступной странице не подтверждена снимком.`,
        kk: `Көрнекі растау: ${verified}/${record.findings.length}. Қалған белгілердің дәйексөзі қолжетімді бет суретімен расталмаған.`,
      });
    await this.store.event(
      record,
      'visual-verification.completed',
      `${verified}/${record.findings.length}`,
    );
  }
}
