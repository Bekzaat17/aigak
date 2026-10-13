import { Check, CircleHelp } from 'lucide-react';
import { useState } from 'react';
import type { CaseRecord, Lang } from '../../../shared/types';

export function Question({
  q,
  lang,
  busy,
  save,
}: {
  q: CaseRecord['clarifications'][number];
  lang: Lang;
  busy: boolean;
  save: (answer: string, note: string) => void;
}) {
  const t = (ru: string, kk: string) => (lang === 'ru' ? ru : kk);
  const [note, setNote] = useState(q.note);
  return (
    <div className="question">
      <h4>
        <CircleHelp size={17} />
        {q.question[lang]}
      </h4>
      <div className="answer-options">
        {(['yes', 'no', 'unknown'] as const).map((a, i) => (
          <button
            disabled={busy}
            key={a}
            className={q.answer === a ? 'selected' : ''}
            onClick={() => save(a, note)}
          >
            {
              [
                t('Да, подтверждено', 'Иә, расталды'),
                t('Нет', 'Жоқ'),
                t('Нужно уточнить', 'Нақтылау қажет'),
              ][i]
            }
            {q.answer === a && <Check size={14} />}
          </button>
        ))}
      </div>
      <textarea
        rows={2}
        aria-label={t('Пояснение к вопросу', 'Сұраққа түсіндірме')}
        maxLength={2000}
        value={note}
        onChange={(e) => setNote(e.target.value)}
        placeholder={t(
          'Основание или что ещё нужно получить…',
          'Негіздеме немесе тағы не алу қажет…',
        )}
      />
      {note !== q.note && (
        <button
          className="text-button"
          disabled={busy || !q.answer}
          onClick={() => save(q.answer, note)}
        >
          {t('Сохранить пояснение', 'Түсіндірмені сақтау')}
        </button>
      )}
      {q.answer === 'unknown' && (
        <p className="question-hint">
          {t(
            'Вопрос остаётся открытым. Уточните источник или добавьте новый материал перед подтверждением пакета.',
            'Сұрақ ашық қалады. Пакетті растамас бұрын дереккөзді нақтылаңыз немесе жаңа материал қосыңыз.',
          )}
        </p>
      )}
    </div>
  );
}
