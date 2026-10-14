import { randomUUID } from 'node:crypto';
import type { AnalysisLevel, CaseRecord } from '../../shared/types.ts';
import type { CaseStore } from './ports/storage.ts';

export async function newCase(
  store: CaseStore,
  input: {
    title: string;
    sourceType: CaseRecord['sourceType'];
    sourceUrl?: string;
    useAi: boolean;
    analysisLevel?: AnalysisLevel;
    demo?: boolean;
    templateId?: string;
  },
): Promise<CaseRecord> {
  const now = new Date().toISOString();
  const c: CaseRecord = {
    ...input,
    analysisLevel: input.analysisLevel || (input.useAi ? 'advanced' : 'basic'),
    templateId: input.templateId || 'builtin',
    clarifications: [],
    likelihood: null,
    assessment: { ru: '', kk: '' },
    demo: !!input.demo,
    id: randomUUID(),
    number: await store.nextNumber(new Date().getFullYear()),
    createdAt: now,
    updatedAt: now,
    status: 'queued',
    step: { ru: 'В очереди', kk: 'Кезекте' },
    engine: 'rules',
    evidence: [],
    findings: [],
    issues: [],
    links: [],
    redirects: [],
    officer: '',
    notes: '',
    audit: [],
  };
  c.useAi = c.analysisLevel !== 'basic';
  c.clarifications = [
    {
      id: 'source',
      question: {
        ru: 'Происхождение материала и его связь с проверяемым ресурсом подтверждены?',
        kk: 'Материалдың шығу тегі мен тексерілетін ресурсқа қатысы расталды ма?',
      },
      answer: '',
      note: '',
    },
    {
      id: 'context',
      question: {
        ru: 'Это предложение или реклама азартной игры, а не новость, критика или учебный пример?',
        kk: 'Бұл жаңалық, сын немесе оқу мысалы емес, құмар ойын ұсынысы не жарнамасы ма?',
      },
      answer: '',
      note: '',
    },
  ];
  c.likelihood = null;
  c.assessment = {
    ru: 'Оценка будет сформирована после анализа.',
    kk: 'Баға талдаудан кейін қалыптасады.',
  };
  await store.event(c, 'case.created', input.demo ? 'synthetic demo' : 'local intake');
  return c;
}
