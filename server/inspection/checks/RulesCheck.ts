import { RULESET_VERSION } from '../../rules/catalog.ts';
import { analyzeRules } from '../../rules/engine.ts';
import type { CheckContext, CheckResult, InspectionCheck } from '../contracts.ts';
import { rulesAssessment } from './rules-assessment.ts';

export class RulesCheck implements InspectionCheck {
  readonly id = 'rules';
  readonly version = RULESET_VERSION;
  readonly name = { ru: 'Базовые признаки', kk: 'Негізгі белгілер' };
  readonly requiresAi = false;
  async execute({ evidence }: CheckContext): Promise<CheckResult> {
    const findings = analyzeRules(evidence);
    const extracted = evidence.filter((e) => e.text?.trim()).length;
    const combinations = findings.filter((f) => f.rule?.kind === 'combination').length;
    const caveats = findings.filter((f) => f.rule?.contexts.length).length;
    const summary = {
      ru: `Материалов с текстом: ${extracted}. Наблюдений: ${findings.length}; сочетаний: ${combinations}; с контекстными оговорками: ${caveats}. Показано до 3 совпадений каждого правила на уникальный текст. Сочетания ищутся в пределах 240 символов одного абзаца. Правила не устанавливают нарушение закона.`,
      kk: `Мәтіні бар материалдар: ${extracted}. Бақылаулар: ${findings.length}; үйлесімдер: ${combinations}; мәнмәтін ескертулері бар: ${caveats}. Бірегей мәтінге әр ереженің 3 сәйкестігіне дейін көрсетіледі. Үйлесімдер бір абзацтың 240 таңбасы ішінде ізделеді. Ережелер заң бұзушылықты анықтамайды.`,
    };
    return {
      status: extracted ? 'completed' : 'skipped',
      findings,
      summary,
      assessment: rulesAssessment(findings.length),
    };
  }
}
