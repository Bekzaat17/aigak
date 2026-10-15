import { AuthenticationOptions } from '../features/intake/AuthenticationOptions';
import { ArrowRight, ArrowUpRight, LockKeyhole, Loader2, Sparkles } from 'lucide-react';
import { translator } from '../i18n/translate.ts';
import type { IntakeScreenProps } from '../features/intake/contracts.ts';
import { UrlSourceInput } from '../features/intake/UrlSourceInput.tsx';
import { IntakeIntroduction } from '../features/intake/IntakeIntroduction.tsx';
import { IntakeSteps } from '../features/intake/IntakeSteps.tsx';
import { AnalysisLevelSelector } from '../features/intake/AnalysisLevelSelector.tsx';
import { IntakeTemplateSelector } from '../features/intake/IntakeTemplateSelector.tsx';
export function IntakeScreen({
  lang,
  authentication,
  url,
  setUrl,
  busy,
  ai,
  analysisLevel,
  setAnalysisLevel,
  setDrawer,
  templates,
  templateId,
  setTemplateId,
  openDemo,
  start,
}: IntakeScreenProps) {
  const t = translator(lang);
  return (
    <>
      <IntakeIntroduction lang={lang} />
      <form className="intake-card" onSubmit={start}>
        <div className="input-area">
          <UrlSourceInput lang={lang} url={url} setUrl={setUrl} />
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
        {analysisLevel === 'pro' && (
          <p>
            {t(
              'Pro: до 400 секунд на сбор, анализ и проверку доказательств. Агент пробует запасные способы; при недоступности источника сохраняет частичный результат.',
              'Pro: жинау, талдау және дәлелдерді тексеруге 400 секундқа дейін. Агент қосалқы тәсілдерді қолданып, дереккөз қолжетімсіз болса ішінара нәтижені сақтайды.',
            )}
          </p>
        )}
        {analysisLevel === 'pro' && authentication && (
          <AuthenticationOptions lang={lang} {...authentication} />
        )}
        <div className="intake-bottom">
          <span>
            <LockKeyhole size={15} />
            {t('Оригиналы хранятся локально', 'Түпнұсқалар жергілікті сақталады')}
          </span>
          <button className="primary" disabled={busy || !url.trim()} type="submit">
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
