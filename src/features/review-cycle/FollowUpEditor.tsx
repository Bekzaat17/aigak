import { useState } from 'react';
import type { CaseRecord, FollowUp, Lang } from '../../../shared/types';

export function FollowUpEditor({
  q,
  c,
  lang,
  busy,
  save,
}: {
  q: FollowUp;
  c: CaseRecord;
  lang: Lang;
  busy: boolean;
  save: (answer: string, ids: string[]) => void;
}) {
  const [answer, setAnswer] = useState(q.answer);
  const [ids, setIds] = useState(q.evidenceIds);
  const t = (ru: string, kk: string) => (lang === 'ru' ? ru : kk);
  return (
    <article className="follow-up">
      <h4>{q.question[lang]}</h4>
      <textarea
        aria-label={q.question[lang]}
        rows={3}
        maxLength={4000}
        value={answer}
        onChange={(e) => setAnswer(e.target.value)}
      />
      <details>
        <summary>
          {t('Материалы, подтверждающие ответ', 'Жауапты растайтын материалдар')} · {ids.length}
        </summary>
        {c.evidence
          .filter((e) => e.kind !== 'metadata')
          .map((e) => (
            <label className="evidence-choice" key={e.id}>
              <input
                type="checkbox"
                checked={ids.includes(e.id)}
                onChange={(event) =>
                  setIds(event.target.checked ? [...ids, e.id] : ids.filter((id) => id !== e.id))
                }
              />
              <span>{e.name}</span>
            </label>
          ))}
      </details>
      <button className="secondary small" disabled={busy} onClick={() => save(answer, ids)}>
        {t('Сохранить ответ', 'Жауапты сақтау')}
      </button>
      {q.answer === answer && answer && <small>{t('Ответ сохранён', 'Жауап сақталды')}</small>}
    </article>
  );
}
