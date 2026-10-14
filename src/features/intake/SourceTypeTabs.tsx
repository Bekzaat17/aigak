import type { Lang } from '../../../shared/types';
import { translator } from '../../i18n/translate.ts';
import { Link2, Upload, FileText } from 'lucide-react';
import type { SourceMode } from './contracts.ts';
export interface SourceTypeTabsProps {
  lang: Lang;
  mode: SourceMode;
  setMode: (mode: SourceMode) => void;
}
export function SourceTypeTabs({ lang, mode, setMode }: SourceTypeTabsProps) {
  const t = translator(lang);

  return (
    <>
      {' '}
      <div className="input-tabs" role="tablist">
        {(
          [
            { id: 'url', icon: Link2, label: t('Ссылка', 'Сілтеме') },
            {
              id: 'file',
              icon: Upload,
              label: t('Файл или скриншот', 'Файл немесе скриншот'),
            },
            { id: 'text', icon: FileText, label: t('Текст', 'Мәтін') },
          ] as const
        ).map((m) => (
          <button
            key={m.id}
            type="button"
            role="tab"
            aria-selected={mode === m.id}
            className={mode === m.id ? 'active' : ''}
            onClick={() => setMode(m.id)}
          >
            <m.icon size={18} />
            {m.label}
          </button>
        ))}
      </div>
    </>
  );
}
