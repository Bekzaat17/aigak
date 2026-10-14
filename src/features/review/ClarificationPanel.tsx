import type { CaseRecord, Lang } from '../../../shared/types';
import { translator } from '../../i18n/translate.ts';
import { MessageSquareText } from 'lucide-react';
import { Question } from './Question.tsx';
type Props = {
  questions: CaseRecord['clarifications'];
  lang: Lang;
  busy: boolean;
  answerClarification: (id: string, answer: string, note: string) => void;
};
export function ClarificationPanel({ questions, lang, busy, answerClarification }: Props) {
  const t = translator(lang);
  return (
    <section className="panel">
      <div className="section-line">
        <h3>
          <MessageSquareText size={20} />
          {t('Уточним перед завершением', 'Аяқтамас бұрын нақтылайық')}
        </h3>
        <span>{t('2 вопроса', '2 сұрақ')}</span>
      </div>
      <p className="muted">
        {t(
          'Ответы — оценка инспектора. Они не заменяют первичные материалы.',
          'Жауаптар — инспектор бағасы. Олар бастапқы материалдарды алмастырмайды.',
        )}
      </p>
      {questions.map((q) => (
        <Question
          key={q.id}
          q={q}
          lang={lang}
          busy={busy}
          save={(answer, note) => answerClarification(q.id, answer, note)}
        />
      ))}
    </section>
  );
}
