import type { Lang } from '../../../shared/types';
import { translator } from '../../i18n/translate.ts';
import { FileCheck2, Settings2 } from 'lucide-react';
import type { DrawerSection } from '../navigation/contracts.ts';
export interface IntakeTemplateSelectorProps {
  lang: Lang;
  templates: { id: string; name: string }[];
  templateId: string;
  setTemplateId: (id: string) => void;
  setDrawer: (section: DrawerSection | null) => void;
}
export function IntakeTemplateSelector({
  lang,
  templates,
  templateId,
  setTemplateId,
  setDrawer,
}: IntakeTemplateSelectorProps) {
  const t = translator(lang);

  return (
    <>
      {' '}
      <div className="intake-options">
        <div className="template-select">
          <FileCheck2 size={17} />
          <label htmlFor="template-select">{t('Шаблон', 'Үлгі')}</label>
          <select
            id="template-select"
            value={templateId}
            onChange={(e) => setTemplateId(e.target.value)}
          >
            {templates.map((a) => (
              <option value={a.id} key={a.id}>
                {a.id === 'builtin' ? t('Базовый aigak', 'aigak негізгі үлгісі') : a.name}
              </option>
            ))}
          </select>
          <button
            type="button"
            className="icon-button"
            aria-label={t('Управление шаблонами', 'Үлгілерді басқару')}
            onClick={() => setDrawer('templates')}
          >
            <Settings2 size={17} />
          </button>
        </div>
      </div>
    </>
  );
}
