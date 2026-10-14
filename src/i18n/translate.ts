import type { Lang } from '../../shared/types';
export function translator(lang: Lang) {
  return (ru: string, kk: string) => (lang === 'ru' ? ru : kk);
}
