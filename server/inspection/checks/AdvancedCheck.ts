import type { Localized } from '../../../shared/types.ts';
import type { CheckContext, CheckResult, InspectionCheck } from '../contracts.ts';

export class AdvancedCheck implements InspectionCheck {
  readonly version = '2.0.0';
  readonly requiresAi = true;
  constructor(
    readonly id: 'context' | 'mechanics' | 'verification' | 'pro_review',
    readonly name: Localized,
  ) {}
  async execute(ctx: CheckContext): Promise<CheckResult> {
    const result = await ctx.analyze(this.id);
    return {
      status: 'completed',
      findings: result.findings,
      summary: result.assessment,
      review: result.review,
      ...(['verification', 'pro_review'].includes(this.id)
        ? {
            assessment: result.assessment,
            ...(result.review && ['ambiguous', 'insufficient'].includes(result.review.status)
              ? {}
              : { likelihood: result.likelihood }),
            replaceFindings: true,
          }
        : {}),
    };
  }
}
