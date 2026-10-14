import { ArrowRight, ArrowUpRight, LockKeyhole, Loader2, Sparkles } from 'lucide-react';
import { translator } from '../i18n/translate.ts';
import type { IntakeScreenProps } from '../features/intake/contracts.ts';
import { UrlSourceInput } from '../features/intake/UrlSourceInput.tsx';
import { FileSourceInput } from '../features/intake/FileSourceInput.tsx';
import { TextSourceInput } from '../features/intake/TextSourceInput.tsx';
import { IntakeIntroduction } from '../features/intake/IntakeIntroduction.tsx';
import { IntakeSteps } from '../features/intake/IntakeSteps.tsx';
import { SourceTypeTabs } from '../features/intake/SourceTypeTabs.tsx';
import { AnalysisLevelSelector } from '../features/intake/AnalysisLevelSelector.tsx';
import { IntakeTemplateSelector } from '../features/intake/IntakeTemplateSelector.tsx';
export function IntakeScreen({
  lang,
  mode,
  setMode,
  url,
  setUrl,
  text,
  setText,
  files,
  setFiles,
  busy,
  ai,
  analysisLevel,
  setAnalysisLevel,
  setDrawer,
  templates,
  templateId,
  setTemplateId,
  drag,
  setDrag,
  uploadRef,
  openDemo,
  addFiles,
  start,
}: IntakeScreenProps) {
  const t = translator(lang);
  return (
    <>
      <IntakeIntroduction lang={lang} />
      <form className="intake-card" onSubmit={start}>
        <SourceTypeTabs lang={lang} mode={mode} setMode={setMode} />
        <div className="input-area">
          {mode === 'url' && <UrlSourceInput lang={lang} url={url} setUrl={setUrl} />}
          {mode === 'file' && (
            <FileSourceInput
              lang={lang}
              files={files}
              setFiles={setFiles}
              drag={drag}
              setDrag={setDrag}
              uploadRef={uploadRef}
              addFiles={addFiles}
            />
          )}
          {mode === 'text' && <TextSourceInput lang={lang} text={text} setText={setText} />}
        </div>
        <IntakeTemplateSelector
          lang={lang}
          templates={templates}
          templateId={templateId}
          setTemplateId={setTemplateId}
          setDrawer={setDrawer}
        />
        <AnalysisLevelSelector
          lang={lang}
          analysisLevel={analysisLevel}
          setAnalysisLevel={setAnalysisLevel}
          ai={ai}
        />
        <div className="intake-bottom">
          <span>
            <LockKeyhole size={15} />
            {t('Оригиналы хранятся локально', 'Түпнұсқалар жергілікті сақталады')}
          </span>
          <button
            className="primary"
            disabled={busy || (mode === 'file' && !files.length)}
            type="submit"
          >
            {busy ? <Loader2 className="spin" size={18} /> : <Sparkles size={18} />}{' '}
            {t('Анализировать', 'Талдау')}
            <ArrowRight size={18} />
          </button>
        </div>
      </form>
      <div className="demo-row">
        <span>
          {t('Хотите сначала посмотреть результат?', 'Алдымен нәтижені көргіңіз келе ме?')}
        </span>
        <button disabled={busy} onClick={() => void openDemo()}>
          {t('Открыть пример', 'Мысалды ашу')}
          <ArrowUpRight size={15} />
        </button>
      </div>
      <IntakeSteps lang={lang} />
    </>
  );
}
