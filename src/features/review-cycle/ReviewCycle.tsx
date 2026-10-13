import { useState } from 'react';
import { levelName } from '../../../shared/inspection';
import type { AnalysisLevel, CaseRecord, Lang } from '../../../shared/types';
import { useCaseMutation } from '../../hooks/useCaseMutation';
import { FollowUpEditor } from './FollowUpEditor.tsx';

export function ReviewCycle({
  c,
  lang,
  busy,
  update,
  run,
}: {
  c: CaseRecord;
  lang: Lang;
  busy: boolean;
  update: (c: CaseRecord) => void;
  run: (fn: () => Promise<void>) => Promise<unknown>;
}) {
  const t = (ru: string, kk: string) => (lang === 'ru' ? ru : kk);
  const [text, setText] = useState('');
  const [files, setFiles] = useState<File[]>([]);
  const [level, setLevel] = useState<AnalysisLevel>(c.analysisLevel);
  const mutate = useCaseMutation(c.id, update);
  const request = async (path: string, method: string, body: unknown) => {
    await mutate(path, body, method);
  };

  return (
    <section className="panel review-cycle">
      <h3>{t('Уточнения и повторная проверка', 'Нақтылау және қайта тексеру')}</h3>
      <p>
        {t(
          'Ответьте на вопросы, приложите недостающие материалы и запустите новую версию. Предыдущие выводы и решения сохранятся.',
          'Сұрақтарға жауап беріп, материалдарды қосып, жаңа нұсқаны іске қосыңыз. Алдыңғы қорытындылар мен шешімдер сақталады.',
        )}
      </p>
      {(c.followUps || []).map((q) => (
        <FollowUpEditor
          key={q.id}
          q={q}
          c={c}
          lang={lang}
          busy={busy}
          save={(answer, evidenceIds) =>
            void run(() => request('questions/' + q.id, 'PATCH', { answer, evidenceIds }))
          }
        />
      ))}
      <details>
        <summary>{t('Добавить материалы', 'Материал қосу')}</summary>
        <textarea
          aria-label={t('Дополнительный текст', 'Қосымша мәтін')}
          value={text}
          onChange={(e) => setText(e.target.value)}
          maxLength={180000}
          rows={4}
        />
        <input
          aria-label={t('Дополнительные файлы', 'Қосымша файлдар')}
          type="file"
          multiple
          accept=".pdf,.png,.jpg,.jpeg,.webp,.txt,.html"
          onChange={(e) => setFiles([...(e.target.files || [])])}
        />
        <button
          className="secondary"
          disabled={busy || (!text.trim() && !files.length)}
          onClick={() =>
            void run(async () => {
              const body = new FormData();
              body.set('text', text);
              files.forEach((f) => body.append('files', f));
              await request('materials', 'POST', body);
              setText('');
              setFiles([]);
            })
          }
        >
          {t('Сохранить материалы', 'Материалдарды сақтау')}
        </button>
      </details>
      {c.materialsPending && (
        <p className="inline-error">
          {t(
            'Новые материалы ещё не проверены. Запустите повторный анализ.',
            'Жаңа материалдар тексерілмеді. Қайта талдауды іске қосыңыз.',
          )}
        </p>
      )}
      <div className="rerun-controls">
        <label>
          {t('Глубина новой проверки', 'Жаңа тексеру тереңдігі')}
          <select value={level} onChange={(e) => setLevel(e.target.value as AnalysisLevel)}>
            {(['basic', 'advanced', 'pro'] as const).map((l) => (
              <option key={l} value={l}>
                {levelName(l)[lang]}
              </option>
            ))}
          </select>
        </label>
        <button
          className="primary"
          disabled={busy}
          onClick={() => void run(() => request('reanalyze', 'POST', { analysisLevel: level }))}
        >
          {t('Повторить анализ', 'Талдауды қайталау')}
        </button>
      </div>
      <p className="muted">
        {t(
          'Сохранённые источники используются повторно. Внешние справочные источники могут обновиться; режимы с ИИ отправят материалы настроенному провайдеру.',
          'Сақталған дереккөздер қайта пайдаланылады. Сыртқы анықтамалар жаңаруы мүмкін; AI режимі материалдарды бапталған провайдерге жібереді.',
        )}
      </p>
      {!!c.revisions?.length && (
        <details>
          <summary>
            {t('История версий', 'Нұсқалар тарихы')} · {c.revisions.length}
          </summary>
          {c.revisions.map((r) => (
            <details key={r.number}>
              <summary>
                {t('Версия', 'Нұсқа')} {r.number} · {levelName(r.analysisLevel)[lang]} ·{' '}
                {new Date(r.savedAt).toLocaleString(lang === 'ru' ? 'ru-KZ' : 'kk-KZ')}
              </summary>
              <p>{r.assessment[lang]}</p>
              <ul>
                {r.findings.map((f) => (
                  <li key={f.id}>
                    {f.title[lang]} —{' '}
                    {f.decision === 'accepted'
                      ? t('Подтверждено', 'Расталды')
                      : f.decision === 'rejected'
                        ? t('Отклонено', 'Қабылданбады')
                        : t('Не проверено', 'Тексерілмеді')}
                    <blockquote>{f.quote}</blockquote>
                    {f.note && <p>{f.note}</p>}
                  </li>
                ))}
              </ul>
              {r.followUps
                .filter((q) => q.answer)
                .map((q) => (
                  <p key={q.id}>
                    <strong>{q.question[lang]}</strong>
                    <br />
                    {q.answer}
                  </p>
                ))}
            </details>
          ))}
        </details>
      )}
    </section>
  );
}
