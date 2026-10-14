import type { Lang } from '../../../shared/types';
import { translator } from '../../i18n/translate.ts';
import { Download } from 'lucide-react';
import { maskPersonalIds } from '../../../shared/osint';
import type { displayObservations } from '../../../shared/osint-presentation';
import type { observationGroups } from './observation-groups.ts';
import { observationLabel } from './observation-label.ts';
export interface ObservationGroupProps {
  lang: Lang;
  caseId: string;
  open: boolean;
  group: ReturnType<typeof observationGroups>[number];
  observations: ReturnType<typeof displayObservations>;
}
export function ObservationGroup({
  lang,
  caseId,
  open,
  group,
  observations,
}: ObservationGroupProps) {
  const t = translator(lang);

  return (
    <details className="resource-group" open={open}>
      <summary>
        <group.icon size={21} />
        <span>
          {group.title}
          <small>
            {observations.length
              ? t(`Записей: ${observations.length}`, `Жазбалар: ${observations.length}`)
              : t('Нет данных', 'Деректер жоқ')}
          </small>
        </span>
        <span className="expand-label">{t('Подробнее', 'Толығырақ')}</span>
      </summary>
      <div className="resource-group-body">
        <p className="muted">{group.description}</p>
        {!observations.length && (
          <p>
            {t(
              'В полученных источниках данные не обнаружены.',
              'Алынған дереккөздерден мәлімет табылмады.',
            )}
          </p>
        )}
        {observations.map((o) => (
          <article key={o.key} className="observation-row">
            <span>{observationLabel(o.kind, lang)}</span>
            <div>
              {o.lines.map((line, i) => (
                <strong className="clean-value" key={i}>
                  {maskPersonalIds(line)}
                </strong>
              ))}
              {o.claimed && (
                <small>
                  {t(
                    'Опубликовано в источнике · принадлежность не подтверждена',
                    'Дереккөзде жарияланған · тиесілілігі расталмаған',
                  )}
                </small>
              )}
              <details>
                <summary>
                  {t('Показать источник', 'Дереккөзді көрсету')}
                  {o.sources.length > 1 ? ` · ${o.sources.length}` : ''}
                </summary>
                {o.sources.map((source) => (
                  <div key={source.id} className="source-proof">
                    {source.quote && <blockquote>{maskPersonalIds(source.quote)}</blockquote>}
                    <p>
                      {source.sourceUrl ||
                        t(
                          'Предоставленный материал / технический ответ',
                          'Берілген материал / техникалық жауап',
                        )}
                    </p>
                    <a
                      className="text-button"
                      href={`/api/cases/${caseId}/evidence/${source.evidenceId}`}
                      download
                    >
                      <Download size={14} />
                      {t('Сохранённый источник', 'Сақталған дереккөз')}
                    </a>
                  </div>
                ))}
              </details>
            </div>
          </article>
        ))}
      </div>
    </details>
  );
}
