import { Check, CheckCheck, ShieldCheck } from 'lucide-react';
import { useState } from 'react';
import { buildDossier } from '../../../shared/dossier';
import type { CaseRecord, Lang } from '../../../shared/types';

export function ReviewForm({
  current,
  lang,
  busy,
  save,
}: {
  current: CaseRecord;
  lang: Lang;
  busy: boolean;
  save: (officer: string, notes: string) => void;
}) {
  const t = (ru: string, kk: string) => (lang === 'ru' ? ru : kk);
  const [officer, setOfficer] = useState(current.officer);
  const [notes, setNotes] = useState(current.notes);
  const ready =
    !current.materialsPending &&
    !(current.followUps || []).some((q) => !q.answer.trim()) &&
    (current.analysisLevel !== 'pro' || buildDossier(current).ready) &&
    current.findings.length > 0 &&
    current.findings.every((f) => f.decision !== 'pending') &&
    current.findings.some((f) => f.decision === 'accepted') &&
    current.clarifications.every((q) => q.answer === 'yes');
  return (
    <form
      className="panel review-form"
      onSubmit={(e) => {
        e.preventDefault();
        save(officer, notes);
      }}
    >
      <h3>
        <ShieldCheck size={20} />
        {t('Проверка инспектором', 'Инспектор тексеруі')}
      </h3>
      <label htmlFor="officer">{t('Имя инспектора', 'Инспектор аты')}</label>
      <input
        id="officer"
        required
        minLength={2}
        maxLength={150}
        value={officer}
        onChange={(e) => setOfficer(e.target.value)}
        placeholder={t('Фамилия и инициалы', 'Тегі мен аты-жөні')}
      />
      <label htmlFor="officer-notes">
        {t('Итог проверки и замечания', 'Тексеру қорытындысы мен ескертулер')}
      </label>
      <textarea
        id="officer-notes"
        required
        minLength={5}
        maxLength={5000}
        value={notes}
        onChange={(e) => setNotes(e.target.value)}
        rows={4}
        placeholder={t(
          'Что подтверждено, чего не хватает, на чём основано решение…',
          'Не расталды, не жетіспейді, шешім неге негізделген…',
        )}
      />
      <button className="primary" disabled={busy || !ready}>
        <CheckCheck size={18} />
        {t('Подтвердить проверку', 'Тексеруді растау')}
      </button>
      {!ready && (
        <p className="field-hint">
          {t(
            'Сначала рассмотрите все признаки и подтвердите происхождение и контекст материала.',
            'Алдымен барлық белгілерді қарап, материалдың шығу тегі мен мәнмәтінін растаңыз.',
          )}
        </p>
      )}
      {current.status === 'verified' && (
        <p className="success-text">
          <Check size={16} />
          {t('Проверка сохранена', 'Тексеру сақталды')} · {current.officer}
        </p>
      )}
    </form>
  );
}
