import type { Lang } from '../../../shared/types';
import { translator } from '../../i18n/translate.ts';

export interface IntakeIntroductionProps {
  lang: Lang;
}
export function IntakeIntroduction({ lang }: IntakeIntroductionProps) {
  const t = translator(lang);

  return (
    <>
      {' '}
      <section className="hero">
        <div className="eyebrow">
          <span className="live-dot" />
          {t('АНАЛИЗ ИГОРНОГО КОНТЕНТА', 'ҚҰМАР ОЙЫН МАЗМҰНЫН ТАЛДАУ')}
        </div>
        <h1>
          {t('От ссылки —', 'Сілтемеден —')}
          <br />
          <span>{t('к доказательствам.', 'дәлелдерге.')}</span>
        </h1>
        <p>
          {t(
            'Добавьте материал. Получите анализ, подтверждающие',
            'Материал қосыңыз. Талдау, растайтын үзінділер',
          )}
          <br className="desktop-break" />
          {t(
            ' фрагменты и готовый проект пакета документов.',
            ' және құжаттар пакетінің дайын жобасын алыңыз.',
          )}
        </p>
      </section>
    </>
  );
}
