import { FileText, Image } from 'lucide-react';
import { useState } from 'react';
import type { CaseRecord, Evidence, Lang } from '../../../shared/types';
import { materialFindings, primaryMaterials } from '../../case-view';
import { SourcePreview } from './SourcePreview.tsx';

export function MaterialsWorkspace({ c, lang }: { c: CaseRecord; lang: Lang }) {
  const t = (ru: string, kk: string) => (lang === 'ru' ? ru : kk);
  const [kind, setKind] = useState('main');
  const [selected, setSelected] = useState('');
  const list = c.evidence.filter(
    (e) =>
      kind === 'all' ||
      (kind === 'images'
        ? e.mime.startsWith('image/')
        : primaryMaterials(c).some((source) => source.id === e.id)),
  );
  const purpose = (e: Evidence) => {
    const matches = materialFindings(c, e);
    return matches.length
      ? t('Основание находок № ', 'Белгілердің негізі № ') +
          matches.map((f) => c.findings.indexOf(f) + 1).join(', ')
      : e.method === 'playwright-screenshot'
        ? t('Снимок проверяемой страницы', 'Тексерілетін беттің суреті')
        : e.kind === 'metadata'
          ? t('Технические сведения', 'Техникалық мәліметтер')
          : t(
              'Исходный материал · связь с находкой не установлена',
              'Бастапқы материал · белгімен байланысы анықталмаған',
            );
  };
  const chosen =
    list.find((e) => e.id === selected) ||
    list.find((e) => e.mime.startsWith('image/') && materialFindings(c, e).length > 0) ||
    list.find((e) => e.capture?.quality === 'adequate') ||
    list[0];
  const title = (e: Evidence) =>
    e.method === 'playwright-screenshot'
      ? t('Снимок страницы', 'Беттің суреті')
      : e.method === 'http-get'
        ? t('Исходная веб-страница', 'Бастапқы веб-бет')
        : e.name;
  return (
    <section>
      <div className="workspace-heading">
        <div>
          <h2>{t('Сохранённые материалы', 'Сақталған материалдар')}</h2>
          <p>
            {t(
              'Скриншоты и оригиналы — здесь. Технические файлы доступны в «Все файлы».',
              'Скриншоттар мен түпнұсқалар осында. Техникалық файлдар «Барлық файлдар» бөлімінде.',
            )}
          </p>
        </div>
        <label>
          {t('Показать', 'Көрсету')}
          <select value={kind} onChange={(e) => setKind(e.target.value)}>
            <option value="main">{t('Оригиналы и снимки', 'Түпнұсқалар мен суреттер')}</option>
            <option value="images">{t('Только изображения', 'Тек кескіндер')}</option>
            <option value="all">{t('Все файлы', 'Барлық файлдар')}</option>
          </select>
        </label>
      </div>
      {chosen ? (
        <div className="finding-split">
          <nav className="finding-index" aria-label={t('Список материалов', 'Материалдар тізімі')}>
            {list.map((e) => (
              <button
                key={e.id}
                onClick={() => setSelected(e.id)}
                className={chosen.id === e.id ? 'selected' : ''}
                aria-current={chosen.id === e.id ? 'true' : undefined}
              >
                {e.mime.startsWith('image/') ? <Image size={19} /> : <FileText size={19} />}
                <span>
                  <strong>{title(e)}</strong>
                  <small>{purpose(e)}</small>
                </span>
              </button>
            ))}
          </nav>
          <article className="finding-detail">
            <h2>{title(chosen)}</h2>
            <p className="material-purpose">{purpose(chosen)}</p>
            <SourcePreview key={chosen.id} c={c} e={chosen} lang={lang} />
          </article>
        </div>
      ) : (
        <div className="empty-result">
          {t(
            'В этой группе файлов нет. Выберите «Все файлы».',
            'Бұл топта файлдар жоқ. «Барлық файлдар» таңдаңыз.',
          )}
        </div>
      )}
    </section>
  );
}
