import { SocialProfiles } from './SocialProfiles';
import { ResourceHistory } from './ResourceHistory';
import { formatDuration } from '../../lib/format-duration';
import type { CaseRecord, Lang } from '../../../shared/types';
import { displayObservations } from '../../../shared/osint-presentation';
import { observationGroups } from './observation-groups.ts';
import { ObservationGroup } from './ObservationGroup.tsx';
import { ResourceRelations } from './ResourceRelations.tsx';
export function OsintPanel({
  current,
  lang,
  onChange,
}: {
  current: CaseRecord;
  lang: Lang;
  onChange?: (c: CaseRecord) => void;
}) {
  const r = current.osint;
  const t = (ru: string, kk: string) => (lang === 'ru' ? ru : kk);
  if (!r)
    return (
      <div className="empty-result">
        {t(
          'Сведения о ресурсе для этой проверки не собирались.',
          'Бұл тексеру үшін ресурс туралы мәліметтер жиналмады.',
        )}
      </div>
    );
  const clean = displayObservations(r.observations, lang);
  const groups = observationGroups(lang);
  return (
    <section className="resource-workspace">
      <div className="workspace-heading">
        <div>
          <h2>{t('Сведения о ресурсе', 'Ресурс туралы мәліметтер')}</h2>
          <p>
            {r.hostname || t('Домен не установлен', 'Домен анықталмады')}
            {r.registrationDomain && r.registrationDomain !== r.hostname
              ? ' · ' + r.registrationDomain
              : ''}
          </p>
        </div>
        <span className="coverage-pill">
          {r.status === 'completed'
            ? t('Доступные данные собраны', 'Қолжетімді деректер жиналды')
            : t('Часть данных недоступна', 'Деректер ішінара қолжетімсіз')}
        </span>
      </div>
      {groups.map((group, i) => {
        const observations = clean.filter((o) => group.kinds.includes(o.kind));
        return (
          <ObservationGroup
            key={i}
            group={group}
            observations={observations}
            caseId={current.id}
            lang={lang}
            open={i === 0}
          />
        );
      })}
      <SocialProfiles current={current} lang={lang} />
      <ResourceHistory current={current} lang={lang} />
      <ResourceRelations current={current} lang={lang} onChange={onChange} />
      <details className="technical-details">
        <summary>
          {t('Полнота и ограничения источников', 'Дереккөздердің толықтығы мен шектеулері')}
        </summary>
        {r.stages.map((stage) => (
          <p key={stage.id}>
            {stage.summary[lang]} · {formatDuration(stage.durationMs, lang)}
          </p>
        ))}
      </details>
    </section>
  );
}
