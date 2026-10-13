import type { CheckContext, CheckResult, InspectionCheck } from '../contracts.ts';

export class LegalCheck implements InspectionCheck {
  readonly id = 'legal';
  readonly version = '2.0.0';
  readonly name = { ru: 'Правовые гипотезы', kk: 'Құқықтық болжамдар' };
  readonly requiresAi = true;
  async execute(ctx: CheckContext): Promise<CheckResult> {
    if (ctx.osint?.legalNorms?.length) {
      const result = await ctx.analyze('legal');
      return {
        status: 'completed',
        summary: result.assessment,
        legalHypotheses: result.legalHypotheses,
      };
    }
    return {
      status: 'skipped',
      summary: {
        ru: 'Проверенный корпус законодательства Казахстана не подключён. Статьи и квалификация не определены; требуется юридическая проверка.',
        kk: 'Қазақстан заңнамасының тексерілген корпусы қосылмаған. Баптар мен саралау анықталмаған; құқықтық тексеру қажет.',
      },
    };
  }
}
