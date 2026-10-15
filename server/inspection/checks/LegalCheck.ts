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
        ru: 'Официальные тексты норм Казахстана не получены или не прошли проверку. Правовая квалификация не установлена; нужна сверка с официальными источниками.',
        kk: 'Қазақстан заңнамасының ресми мәтіндері алынбады немесе тексеруден өтпеді. Құқықтық саралау анықталмады; ресми дереккөздермен салыстыру қажет.',
      },
    };
  }
}
