import { useState } from 'react';
import type { CaseRecord, Lang } from '../../../shared/types';
import { relationName } from './presentation.ts';
import { RelationReview } from './RelationReview.tsx';

export function ResourceGraph({
  c,
  lang,
  onChange,
}: {
  c: CaseRecord;
  lang: Lang;
  onChange?: (c: CaseRecord) => void;
}) {
  const [selected, setSelected] = useState('');
  const relations = c.osint?.relations || [];
  const r = relations.find((r) => r.id === selected) || relations[0];
  const t = (ru: string, kk: string) => (lang === 'ru' ? ru : kk);
  if (!r) return null;
  return (
    <section className="resource-map">
      <h3>{t('Карта связей', 'Байланыстар картасы')}</h3>
      <div className="graph-origin">{c.osint?.hostname}</div>
      <div className="graph-branches">
        {relations.map((edge) => (
          <button
            key={edge.id}
            className={edge.id === r.id ? 'selected' : ''}
            onClick={() => setSelected(edge.id)}
            aria-pressed={edge.id === r.id}
          >
            <small>{relationName(edge.kind, lang)}</small>
            <strong>{edge.to}</strong>
          </button>
        ))}
      </div>
      <RelationReview key={r.id} c={c} r={r} lang={lang} onChange={onChange} />
    </section>
  );
}
