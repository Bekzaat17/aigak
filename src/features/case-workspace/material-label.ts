import type { CaseRecord, Evidence, Lang } from '../../../shared/types';
import { materialFindings } from '../../case-view';

export function materialLabel(c: CaseRecord, e: Evidence, lang: Lang) {
  const t = (ru: string, kk: string) => (lang === 'ru' ? ru : kk);
  const finding = materialFindings(c, e)[0];
  if (finding && e.mime.startsWith('image/')) return t('Снимок: ', 'Сурет: ') + finding.title[lang];
  let location = '';
  try {
    const u = new URL(e.sourceUrl!);
    location = u.hostname + (u.pathname === '/' ? '' : u.pathname);
  } catch {
    /* Uploaded evidence has no URL. */
  }
  const label = e.method.startsWith('official-registry')
    ? t('Реестр лицензий', 'Лицензиялар тізілімі')
    : e.method.startsWith('official-')
      ? t('Официальный текст закона', 'Заңның ресми мәтіні')
      : e.method.startsWith('detective-')
        ? t('Проверка связанного ресурса', 'Байланысты ресурсты тексеру')
        : e.method === 'finding-screenshot'
          ? t('Снимок предыдущей проверки', 'Алдыңғы тексеру суреті')
          : e.mime.startsWith('image/')
            ? t('Снимок страницы', 'Бет суреті')
            : e.kind === 'metadata'
              ? t('Технические сведения', 'Техникалық мәліметтер')
              : e.mime === 'text/html'
                ? t('Сохранённая страница', 'Сақталған бет')
                : e.kind === 'text'
                  ? t('Текст страницы', 'Бет мәтіні')
                  : t('Сохранённый документ', 'Сақталған құжат');
  return label + (location ? ' · ' + location : '');
}
