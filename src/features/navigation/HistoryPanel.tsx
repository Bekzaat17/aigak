import type { Lang } from '../../../shared/types';
import { translator } from '../../i18n/translate.ts';
import { Search, Globe2, FileText, ArrowUpRight } from 'lucide-react';
import type { CaseSummary } from '../../../shared/types';
import { date } from '../../lib/format.ts';
export interface HistoryPanelProps {
  lang: Lang;
  records: CaseSummary[];
  query: string;
  setQuery: (value: string) => void;
  openSavedCase: (id: string) => Promise<void>;
}
export function HistoryPanel({ lang, records, query, setQuery, openSavedCase }: HistoryPanelProps) {
  const t = translator(lang);

  return (
    <>
      <div className="eyebrow">{t('ВАШЕ РАБОЧЕЕ ПРОСТРАНСТВО', 'СІЗДІҢ ЖҰМЫС КЕҢІСТІГІҢІЗ')}</div>
      <h2>{t('История анализов', 'Талдаулар тарихы')}</h2>
      <div className="search-field">
        <Search size={18} />
        <input
          aria-label={t('Поиск', 'Іздеу')}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={t('Найти по названию или номеру', 'Атауы немесе нөмірі бойынша іздеу')}
        />
      </div>
      <div className="history-list">
        {records
          .filter((r) => (r.title + r.number).toLowerCase().includes(query.toLowerCase()))
          .map((r) => (
            <button key={r.id} onClick={() => void openSavedCase(r.id)}>
              <div className="file-icon">
                {r.sourceType === 'url' ? <Globe2 size={22} /> : <FileText size={22} />}
              </div>
              <div>
                <strong>{r.title}</strong>
                <span>
                  {r.number} · {date(r.createdAt, lang)}
                </span>
                <small>
                  {r.demo
                    ? t('Учебный пример', 'Оқу мысалы')
                    : r.status === 'verified'
                      ? t('Проверено', 'Тексерілген')
                      : r.step[lang]}
                </small>
              </div>
              <ArrowUpRight size={18} />
            </button>
          ))}
        {!!records.length &&
          !records.some((r) =>
            (r.title + r.number).toLowerCase().includes(query.toLowerCase()),
          ) && (
            <p className="empty-history">
              {t(
                'Ничего не найдено. Попробуйте другое название или номер.',
                'Ештеңе табылмады. Басқа атау не нөмір енгізіңіз.',
              )}
            </p>
          )}
        {!records.length && (
          <p className="empty-history">
            {t(
              'Здесь появятся ваши анализы. Начните со ссылки или файла.',
              'Талдауларыңыз осында пайда болады. Сілтемеден немесе файлдан бастаңыз.',
            )}
          </p>
        )}
      </div>
    </>
  );
}
