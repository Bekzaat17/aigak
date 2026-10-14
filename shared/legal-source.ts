import type { LegalNorm } from './osint';
import type { Lang, Localized } from './types';

const titles: Record<string, Localized> = {
  Z070000219_: { ru: 'Закон РК «Об игорном бизнесе»', kk: '«Ойын бизнесі туралы» ҚР заңы' },
  Z030000508_: { ru: 'Закон РК «О рекламе»', kk: '«Жарнама туралы» ҚР заңы' },
  K1400000226: { ru: 'Уголовный кодекс РК', kk: 'ҚР Қылмыстық кодексі' },
  K1400000235: {
    ru: 'Кодекс РК об административных правонарушениях',
    kk: 'ҚР Әкімшілік құқық бұзушылық туралы кодексі',
  },
  Z040000567_: { ru: 'Закон РК «О связи»', kk: '«Байланыс туралы» ҚР заңы' },
};
/** Resolve legacy records by official document identity, never by article number alone. */
export function legalSourceTitle(norm: LegalNorm, lang: Lang) {
  let documentId = norm.documentId;
  try {
    const url = new URL(norm.sourceUrl);
    if (url.hostname === 'adilet.zan.kz' || url.hostname.endsWith('.adilet.zan.kz'))
      documentId ??= url.pathname.match(/\/docs\/([^/]+)/)?.[1];
  } catch {
    /* Unknown sources retain their supplied title. */
  }
  return (
    titles[documentId || '']?.[lang] ||
    norm.title?.[lang] ||
    (lang === 'ru' ? 'Нормативный акт' : 'Нормативтік акт')
  );
}
