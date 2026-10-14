import type { Lang } from '../../../shared/types';
import { translator } from '../../i18n/translate.ts';
import { Globe2 } from 'lucide-react';
export interface UrlSourceInputProps {
  lang: Lang;
  url: string;
  setUrl: (value: string) => void;
}
export function UrlSourceInput({ lang, url, setUrl }: UrlSourceInputProps) {
  const t = translator(lang);

  return (
    <>
      <label htmlFor="source-url">
        {t('Адрес страницы для проверки', 'Тексерілетін беттің мекенжайы')}
      </label>
      <div className="url-field">
        <Globe2 size={22} />
        <input
          id="source-url"
          type="text"
          inputMode="url"
          required
          placeholder={t(
            'example.com или https://example.com',
            'example.com немесе https://example.com',
          )}
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          autoComplete="off"
        />
        <span className="key-hint">URL</span>
      </div>
      <p className="field-hint">
        {t(
          'Можно вставить домен без https:// или полную ссылку.',
          'https:// жоқ доменді немесе толық сілтемені қоюға болады.',
        )}
      </p>
    </>
  );
}
