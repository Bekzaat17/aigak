import type { Lang } from '../../../shared/types';
import { translator } from '../../i18n/translate.ts';
import { levels } from '../../../shared/inspection';
import type { AnalysisLevel } from '../../../shared/types';
export interface AnalysisLevelSelectorProps {
  lang: Lang;
  analysisLevel: AnalysisLevel;
  setAnalysisLevel: (level: AnalysisLevel) => void;
  ai: boolean;
}
export function AnalysisLevelSelector({
  lang,
  analysisLevel,
  setAnalysisLevel,
  ai,
}: AnalysisLevelSelectorProps) {
  const t = translator(lang);

  return (
    <>
      {' '}
      <fieldset className="level-selector">
        <legend>{t('Глубина проверки', 'Тексеру тереңдігі')}</legend>
        <div>
          {levels.map((level) => (
            <label key={level.id} className={analysisLevel === level.id ? 'selected' : ''}>
              <input
                type="radio"
                name="analysis-level"
                value={level.id}
                checked={analysisLevel === level.id}
                onChange={() => setAnalysisLevel(level.id)}
              />
              <strong>{level.name[lang]}</strong>
              <span>{level.description[lang]}</span>
            </label>
          ))}
        </div>
      </fieldset>
      {analysisLevel !== 'basic' && (
        <p className="ai-disclosure">
          {ai
            ? t(
                'Извлечённый текст передаётся настроенному ИИ-сервису. Число этапов зависит от глубины проверки.',
                'Алынған мәтін бапталған AI сервисіне жіберіледі. Кезеңдер саны тексеру тереңдігіне байланысты.',
              )
            : t(
                'ИИ не подключён: выполнятся локальные проверки, результат будет частичным.',
                'AI қосылмаған: жергілікті тексерулер орындалады, нәтиже ішінара болады.',
              )}
        </p>
      )}
    </>
  );
}
