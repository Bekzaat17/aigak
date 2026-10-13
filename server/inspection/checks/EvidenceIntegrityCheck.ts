import type { CheckContext, CheckResult, InspectionCheck } from '../contracts.ts';

export class EvidenceIntegrityCheck implements InspectionCheck {
  readonly id = 'integrity';
  readonly version = '1.0.0';
  readonly name = {
    ru: 'Проверка связи цитат с материалами',
    kk: 'Дәйексөздердің материалдармен байланысын тексеру',
  };
  readonly requiresAi = false;
  async execute(ctx: CheckContext): Promise<CheckResult> {
    for (const f of ctx.findings) {
      const e = ctx.evidence.find((e) => e.id === f.evidenceId);
      if (!f.quote || !e?.text || e.text.slice(f.start, f.end) !== f.quote)
        throw new Error('UNGROUNDED_FINDING');
    }
    return {
      status: 'completed',
      summary: {
        ru: `Проверены точные цитаты: ${ctx.findings.length}. Это не проверка достоверности самого источника.`,
        kk: `Нақты дәйексөздер тексерілді: ${ctx.findings.length}. Бұл дереккөздің өзінің дұрыстығын тексеру емес.`,
      },
    };
  }
}
