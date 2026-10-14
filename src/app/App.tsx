import { AlertCircle, ArrowUpRight, X } from 'lucide-react';
import { AppDrawer } from './AppDrawer.tsx';
import { AppHeader } from './AppHeader.tsx';
import { CaseScreen } from './CaseScreen.tsx';
import { IntakeScreen } from './IntakeScreen.tsx';
import { useAppController } from './useAppController.ts';
export function App() {
  const controller = useAppController();
  const { t, current, error, setError, setDrawer, errMessage } = controller;
  return (
    <div className="app-shell">
      <AppHeader
        lang={controller.lang}
        setLang={controller.setLang}
        t={controller.t}
        records={controller.records}
        setDrawer={controller.setDrawer}
        run={controller.run}
        refreshHistory={controller.refreshHistory}
        reset={controller.reset}
      />
      <main>
        {error && (
          <div className="error-banner" role="alert">
            <AlertCircle size={20} />
            <span>{errMessage}</span>
            <button aria-label={t('Закрыть', 'Жабу')} onClick={() => setError('')}>
              <X size={18} />
            </button>
          </div>
        )}
        {!current ? (
          <IntakeScreen
            lang={controller.lang}
            url={controller.url}
            setUrl={controller.setUrl}
            busy={controller.busy}
            ai={controller.ai}
            analysisLevel={controller.analysisLevel}
            setAnalysisLevel={controller.setAnalysisLevel}
            setDrawer={controller.setDrawer}
            templates={controller.templates}
            templateId={controller.templateId}
            setTemplateId={controller.setTemplateId}
            openDemo={controller.openDemo}
            start={controller.start}
          />
        ) : (
          <CaseScreen
            key={current.id}
            current={current}
            lang={controller.lang}
            setCurrent={controller.setCurrent}
            busy={controller.busy}
            templates={controller.templates}
            tab={controller.tab}
            run={controller.run}
            saveFinding={controller.saveFinding}
            answerClarification={controller.answerClarification}
            approveReview={controller.approveReview}
            processing={controller.processing}
            openTab={controller.openTab}
            reviewFindings={controller.reviewFindings}
            reset={controller.reset}
            exportZip={controller.exportZip}
          />
        )}
      </main>
      <footer className="footer">
        <span>
          <span className="live-dot" />
          {t('Локальное рабочее пространство', 'Жергілікті жұмыс кеңістігі')}
        </span>
        <span>aigak · {t('Решение остаётся за человеком', 'Шешімді адам қабылдайды')}</span>
        <button onClick={() => setDrawer('templates')}>
          {t('Шаблоны документов', 'Құжат үлгілері')}
          <ArrowUpRight size={14} />
        </button>
      </footer>
      {
        <AppDrawer
          lang={controller.lang}
          records={controller.records}
          busy={controller.busy}
          error={controller.error}
          ai={controller.ai}
          drawer={controller.drawer}
          setDrawer={controller.setDrawer}
          templates={controller.templates}
          templateFields={controller.templateFields}
          templateId={controller.templateId}
          setTemplateId={controller.setTemplateId}
          query={controller.query}
          setQuery={controller.setQuery}
          templateRef={controller.templateRef}
          openSavedCase={controller.openSavedCase}
          changeTemplate={controller.changeTemplate}
          errMessage={controller.errMessage}
        />
      }
    </div>
  );
}
