import type { Lang } from '../../../shared/types';
import { translator } from '../../i18n/translate.ts';
import { Network } from 'lucide-react';
import type { CaseRecord } from '../../../shared/types';
import { ResourceGraph } from './ResourceGraph.tsx';
export interface ResourceRelationsProps {
  current: CaseRecord;
  lang: Lang;
  onChange?: (record: CaseRecord) => void;
}
export function ResourceRelations({ current, lang, onChange }: ResourceRelationsProps) {
  const t = translator(lang);
  const r = current.osint;
  if (!r) return null;
  return (
    <details className="resource-group">
      <summary>
        <Network size={21} />
        <span>
          {t('Связи с другими ресурсами', 'Басқа ресурстармен байланыстар')}
          <small>
            {r.relations?.length || 0} {t('технических связей', 'техникалық байланыс')}
          </small>
        </span>
        <span className="expand-label">{t('Подробнее', 'Толығырақ')}</span>
      </summary>
      <div className="resource-group-body">
        <p>
          {t(
            'Это технические наблюдения. Зеркалирование и общий владелец не подтверждены.',
            'Бұл — техникалық бақылаулар. Айна сайт пен ортақ ие расталмаған.',
          )}
        </p>
        {!r.relations?.length && (
          <p>
            {current.analysisLevel === 'pro'
              ? t(
                  'В доступных источниках связи не обнаружены.',
                  'Қолжетімді дереккөздерден байланыстар табылмады.',
                )
              : t(
                  'Поиск связей выполняется в режиме Pro.',
                  'Байланыстарды іздеу Pro режимінде орындалады.',
                )}
          </p>
        )}
        <ResourceGraph c={current} lang={lang} onChange={onChange} />
        {r.candidates?.map((candidate) => (
          <p key={candidate.hostname}>
            {candidate.hostname} ·{' '}
            {candidate.status === 'content_checked'
              ? t(
                  'Содержимое сохранено и передано на анализ',
                  'Мазмұны сақталып, талдауға жіберілді',
                )
              : candidate.status === 'dns_checked'
                ? t('DNS проверен; содержимое не изучено', 'DNS тексерілді; мазмұны зерттелмеді')
                : candidate.status === 'unavailable'
                  ? t('Проверка недоступна', 'Тексеру қолжетімсіз')
                  : t('Не проверен: лимит обхода', 'Тексерілмеді: аралау шегі')}
          </p>
        ))}
      </div>
    </details>
  );
}
