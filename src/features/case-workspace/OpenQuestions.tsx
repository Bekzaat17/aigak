import type { CaseRecord, Lang } from '../../../shared/types';

export function OpenQuestions({ c, lang }: { c: CaseRecord; lang: Lang }) {
  const t = (ru: string, kk: string) => (lang === 'ru' ? ru : kk);
  const questions = [
    ...new Set(
      (c.inspection?.stages || [])
        .flatMap((s) => [
          ...(s.review?.questions || []),
          ...(s.legalHypotheses || []).flatMap((h) => h.missing),
        ])
        .map((q) => q[lang]),
    ),
  ];
  if (!questions.length) return null;
  return (
    <section className="panel open-questions">
      <h3>{t('Что ещё нужно выяснить', 'Тағы нені анықтау қажет')}</h3>
      <p>
        {t(
          'Вопросы анализа. Ответы и недостающие материалы укажите в итоговых замечаниях ниже.',
          'Талдау сұрақтары. Жауаптар мен жетіспейтін материалдарды төмендегі қорытынды ескертулерге жазыңыз.',
        )}
      </p>
      <ul>
        {questions.map((q) => (
          <li key={q}>{q}</li>
        ))}
      </ul>
    </section>
  );
}
