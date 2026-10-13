import type { CheckContext, CheckResult, InspectionCheck } from '../contracts.ts';

export class ConnectionsCheck implements InspectionCheck {
  readonly id = 'connections';
  readonly version = '2.0.0';
  readonly name = { ru: 'Связи и внешние источники', kk: 'Байланыстар және сыртқы дереккөздер' };
  readonly requiresAi = false;
  async execute(ctx: CheckContext): Promise<CheckResult> {
    const stage =
      ctx.osint?.stages.find((s) => s.id === 'candidate-content') ||
      ctx.osint?.stages.find((s) => s.id === 'detective');
    if (stage) return { status: 'partial', summary: stage.summary };
    return {
      status: 'skipped',
      summary: {
        ru: `В материале ${ctx.links.length} ссылок для проверки. Внешний поисковый провайдер не подключён; связи и владельцы не установлены.`,
        kk: `Материалда тексеруге арналған ${ctx.links.length} сілтеме бар. Сыртқы іздеу провайдері қосылмаған; байланыстар мен иелер анықталмаған.`,
      },
    };
  }
}
