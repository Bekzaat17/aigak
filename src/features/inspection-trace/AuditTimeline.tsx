import type { CaseRecord, Lang } from '../../../shared/types';
import { translator } from '../../i18n/translate.ts';
import { auditLabel } from '../../i18n/audit-label.ts';
import { date } from '../../lib/format.ts';
type Props = { audit: CaseRecord['audit']; lang: Lang };
export function AuditTimeline({ audit, lang }: Props) {
  const t = translator(lang);
  return (
    <section className="panel">
      <h3>{t('История работы с материалами', 'Материалдармен жұмыс тарихы')}</h3>
      <p className="muted">
        {t(
          'Локальная цепочка событий с контрольными суммами. Без внешнего заверения времени.',
          'Бақылау сомалары бар жергілікті оқиғалар тізбегі. Уақыт сырттай куәландырылмаған.',
        )}
      </p>
      <div className="timeline">
        {audit.map((a) => (
          <div key={a.id}>
            <span className="timeline-dot" />
            <div>
              <small>{date(a.at, lang)}</small>
              <strong>{auditLabel(a.action, lang)}</strong>
              <p>{a.detail}</p>
              <code>{a.hash}</code>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
