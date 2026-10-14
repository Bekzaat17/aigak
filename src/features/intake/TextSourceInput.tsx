import type { Lang } from '../../../shared/types';
import { translator } from '../../i18n/translate.ts';

export interface TextSourceInputProps {
  lang: Lang;
  text: string;
  setText: (value: string) => void;
}
export function TextSourceInput({ lang, text, setText }: TextSourceInputProps) {
  const t = translator(lang);

  return (
    <>
      <label htmlFor="source-text">{t('Текст материала', 'Материал мәтіні')}</label>
      <textarea
        id="source-text"
        required
        value={text}
        maxLength={180000}
        onChange={(e) => setText(e.target.value)}
        rows={5}
        placeholder={t(
          'Вставьте текст публикации или страницы…',
          'Жарияланым немесе бет мәтінін қойыңыз…',
        )}
      />
      <p className="field-hint">
        {t(
          'Сохраним исходный текст и выделим фрагменты с признаками.',
          'Бастапқы мәтінді сақтап, белгілері бар үзінділерді бөлеміз.',
        )}
      </p>
    </>
  );
}
