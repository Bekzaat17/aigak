import { X } from 'lucide-react';
import { translator } from '../i18n/translate.ts';
import { HistoryPanel, type HistoryPanelProps } from '../features/navigation/HistoryPanel.tsx';
import {
  TemplatesPanel,
  type TemplatesPanelProps,
} from '../features/navigation/TemplatesPanel.tsx';
import { HelpPanel, type HelpPanelProps } from '../features/navigation/HelpPanel.tsx';
import type { DrawerSection } from '../features/navigation/contracts.ts';
export type AppDrawerProps = HistoryPanelProps &
  TemplatesPanelProps &
  HelpPanelProps & {
    drawer: DrawerSection | null;
    setDrawer: (section: DrawerSection | null) => void;
  };
export function AppDrawer(props: AppDrawerProps) {
  const { drawer, setDrawer, lang } = props;
  const t = translator(lang);
  if (!drawer) return null;
  return (
    <div className="overlay" onClick={() => setDrawer(null)}>
      <section
        className="drawer"
        role="dialog"
        aria-modal="true"
        aria-label={
          drawer === 'history'
            ? t('История', 'Тарих')
            : drawer === 'templates'
              ? t('Шаблоны', 'Үлгілер')
              : t('Как это работает', 'Қалай жұмыс істейді')
        }
        onClick={(event) => event.stopPropagation()}
      >
        <button
          className="close-drawer icon-button"
          aria-label={t('Закрыть', 'Жабу')}
          onClick={() => setDrawer(null)}
        >
          <X size={22} />
        </button>
        {drawer === 'history' && (
          <HistoryPanel
            lang={lang}
            records={props.records}
            query={props.query}
            setQuery={props.setQuery}
            openSavedCase={props.openSavedCase}
          />
        )}
        {drawer === 'templates' && (
          <TemplatesPanel
            lang={lang}
            busy={props.busy}
            error={props.error}
            errMessage={props.errMessage}
            templates={props.templates}
            templateFields={props.templateFields}
            templateId={props.templateId}
            setTemplateId={props.setTemplateId}
            templateRef={props.templateRef}
            changeTemplate={props.changeTemplate}
          />
        )}
        {drawer === 'help' && <HelpPanel lang={lang} ai={props.ai} />}
      </section>
    </div>
  );
}
