import { materialLabel } from './material-label';
import { FileText, Image } from 'lucide-react';
import { useState } from 'react';
import type { CaseRecord, Evidence, Lang } from '../../../shared/types';
import { materialFindings, primaryMaterials } from '../../case-view';
import { SourcePreview } from './SourcePreview.tsx';

export function MaterialsWorkspace({ c, lang }: { c: CaseRecord; lang: Lang }) {
  const t = (ru: string, kk: string) => (lang === 'ru' ? ru : kk);
  const [kind, setKind] = useState('main');
  const [selected, setSelected] = useState('');
  const list =
    kind === 'all'
      ? c.evidence
      : primaryMaterials(c).filter((e) => kind !== 'images' || e.mime.startsWith('image/'));
  const purpose = (e: Evidence) => {
    const matches = materialFindings(c, e);
    return matches.length
      ? t('Основание находок № ', 'Белгілердің негізі № ') +
          matches.map((f) => c.findings.indexOf(f) + 1).join(', ')
      : e.method === 'playwright-screenshot'
        ? t('Снимок проверяемой страницы', 'Тексерілетін беттің суреті')
        : e.kind === 'metadata'
          ? t('Технические сведения', 'Техникалық мәліметтер')
          : t('Контекст проверяемой страницы', 'Тексерілетін беттің мәнмәтіні');
  };
  const chosen =
    list.find((e) => e.id === selected) ||
    list.find((e) => e.mime.startsWith('image/') && materialFindings(c, e).length > 0) ||
    list.find((e) => e.capture?.quality === 'adequate') ||
    list[0];
  const title = (e: Evidence) => materialLabel(c, e, lang);
  return (
    <section>
      <div className="workspace-heading">
        <div>
          <h2>{t('Доказательная база', 'Дәлелдемелер базасы')}</h2>
          <p>
            {t(
              'Здесь — подтверждённые снимки находок и тексты с точными цитатами. Наличие признака не означает доказанного правонарушения. Попытки доступа и страницы защиты сохранены только в архиве.',
              'Мұнда белгілердің тексерілген суреттері мен дәл дәйексөздері бар мәтіндер көрсетілген. Белгі құқық бұзушылықты дәлелдемейді. Қорғаныс беттері тек мұрағатта сақталған.',
            )}
          </p>
        </div>
        <label>
          {t('Показать', 'Көрсету')}
          <select value={kind} onChange={(e) => setKind(e.target.value)}>
            <option value="main">{t('Доказательства находок', 'Белгілердің дәлелдемелері')}</option>
            <option value="images">{t('Подтверждённые снимки', 'Тексерілген суреттер')}</option>
            <option value="all">{t('Архив и технические файлы', 'Барлық файлдар')}</option>
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
            'Подтверждённых материалов в этой группе пока нет. Страницы защиты и неподтверждённые снимки не считаются доказательствами.',
            'Бұл топта файлдар жоқ. «Барлық файлдар» таңдаңыз.',
          )}
        </div>
      )}
    </section>
  );
}
