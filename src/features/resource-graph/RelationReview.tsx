import { useState } from 'react';
import type { ResourceRelation } from '../../../shared/osint';
import type { CaseRecord, Lang } from '../../../shared/types';
import { useCaseMutation } from '../../hooks/useCaseMutation';
import { relationName } from './presentation.ts';

export function RelationReview({
  c,
  r,
  lang,
  onChange,
}: {
  c: CaseRecord;
  r: ResourceRelation;
  lang: Lang;
  onChange?: (c: CaseRecord) => void;
}) {
  const [note, setNote] = useState(r.note || '');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(false);
  const mutate = useCaseMutation(c.id, onChange);
  const t = (ru: string, kk: string) => (lang === 'ru' ? ru : kk);
  const save = async (decision: string) => {
    setBusy(true);
    setError(false);
    try {
      await mutate(`relations/${r.id}`, { decision, note });
    } catch {
      setError(true);
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="relation-review">
      <h4>
        {relationName(r.kind, lang)}: {r.from} → {r.to}
      </h4>
      {r.description && <p>{r.description}</p>}
      <p>
        {t(
          'Подтверждайте только указанное наблюдение. Совпадение не устанавливает владельца или статус зеркала.',
          'Тек көрсетілген бақылауды растаңыз. Сәйкестік иені не айна мәртебесін анықтамайды.',
        )}
      </p>
      {r.evidenceIds.map((id, i) => (
        <a className="text-button" key={id} href={`/api/cases/${c.id}/evidence/${id}`} download>
          {t('Источник', 'Дереккөз')} {i + 1}
        </a>
      ))}
      <textarea
        aria-label={t('Пояснение к связи', 'Байланысқа түсіндірме')}
        value={note}
        onChange={(e) => setNote(e.target.value)}
        maxLength={2000}
      />
      <div className="decision-options">
        {(['accepted', 'rejected', 'pending'] as const).map((d, i) => (
          <button
            key={d}
            disabled={busy || !onChange}
            className={r.decision === d ? 'chosen' : ''}
            onClick={() => void save(d)}
          >
            {
              [
                t('Подтвердить наблюдение', 'Бақылауды растау'),
                t('Отклонить', 'Қабылдамау'),
                t('Нужно уточнить', 'Нақтылау қажет'),
              ][i]
            }
          </button>
        ))}
      </div>
      {error && <p role="alert">{t('Не удалось сохранить решение.', 'Шешім сақталмады.')}</p>}
    </div>
  );
}
