import { useEffect, useState } from 'react';
import type { Lang } from '../../shared/types';
export function useLocale() {
  const [lang, setLang] = useState<Lang>(() =>
    localStorage.getItem('aigak.lang') === 'kk' ? 'kk' : 'ru',
  );
  const t = (ru: string, kk: string) => (lang === 'ru' ? ru : kk);
  useEffect(() => {
    document.documentElement.lang = lang;
    localStorage.setItem('aigak.lang', lang);
  }, [lang]);
  return { lang, setLang, t };
}
