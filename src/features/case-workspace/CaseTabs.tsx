import type { CaseRecord, Lang } from '../../../shared/types';
import { translator } from '../../i18n/translate.ts';
import { primaryMaterials } from '../../case-view';
import type { CaseTab } from './contracts.ts';
type Props = { current: CaseRecord; lang: Lang; tab: CaseTab; openTab: (tab: CaseTab) => void };
export function CaseTabs({ current, lang, tab, openTab }: Props) {
  const t = translator(lang);
  return (
    <div className="result-tabs" aria-label={t('Разделы проверки', 'Тексеру бөлімдері')}>
      {(
        [
          {
            id: 'analysis',
            label: t('Выводы', 'Қорытындылар'),
            count: current.findings.length,
          },
          {
            id: 'evidence',
            label: t('Материалы', 'Материалдар'),
            count: primaryMaterials(current).length,
          },
          { id: 'osint', label: t('О ресурсе', 'Ресурс туралы') },
          { id: 'law', label: t('Закон', 'Заң') },
          { id: 'package', label: t('Проверка и пакет', 'Тексеру және пакет') },
        ] as const
      ).map((x) => (
        <button
          key={x.id}
          aria-pressed={tab === x.id}
          className={tab === x.id ? 'active' : ''}
          onClick={() => openTab(x.id)}
        >
          {x.label}
          {'count' in x && <span>{x.count}</span>}
        </button>
      ))}
    </div>
  );
}
