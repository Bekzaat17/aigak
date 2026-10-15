import { materialLabel } from './material-label';
import { Download, FileText, Search, X } from 'lucide-react';
import { useRef } from 'react';
import type { CaseRecord, Evidence, Lang } from '../../../shared/types';
import { href, stamp } from './presentation.ts';

export function SourcePreview({
  c,
  e,
  lang,
  quote,
}: {
  c: CaseRecord;
  e: Evidence;
  lang: Lang;
  quote?: string;
}) {
  const t = (ru: string, kk: string) => (lang === 'ru' ? ru : kk);
  const dialog = useRef<HTMLDialogElement>(null);
  return (
    <div className="source-preview">
      {e.access === 'authenticated' && (
        <p className="preview-label">
          {t(
            'Материал получен после входа в аккаунт',
            'Материал тіркелгіге кіргеннен кейін алынды',
          )}
        </p>
      )}
      {e.mime.startsWith('image/') && (
        <button
          className="preview-image"
          onClick={() => dialog.current?.showModal()}
          aria-label={t('Увеличить изображение', 'Кескінді үлкейту')}
        >
          <img src={href(c, e)} alt={materialLabel(c, e, lang)} loading="lazy" />
          <span>
            <Search size={15} />
            {t('Увеличить', 'Үлкейту')}
          </span>
        </button>
      )}
      {quote && (
        <blockquote>
          <mark>{quote}</mark>
        </blockquote>
      )}
      <div className="source-caption">
        <span>
          <FileText size={15} />
          {materialLabel(c, e, lang)}
          <small>{stamp(e.createdAt, lang)}</small>
        </span>
        <a href={href(c, e)} download={materialLabel(c, e, lang)}>
          <Download size={16} />
          {t('Оригинал', 'Түпнұсқа')}
        </a>
      </div>
      {e.text && (
        <details>
          <summary>{t('Полный текст материала', 'Материалдың толық мәтіні')}</summary>
          <pre>{e.text}</pre>
        </details>
      )}
      {e.sourceUrl && (
        <a href={e.sourceUrl} target="_blank" rel="noreferrer">
          {e.sourceUrl}
        </a>
      )}
      <details>
        <summary>{t('Источник и целостность файла', 'Дереккөз және файл тұтастығы')}</summary>
        <p>
          {e.sourceUrl ? (
            <a href={e.sourceUrl} target="_blank" rel="noreferrer">
              {e.sourceUrl}
            </a>
          ) : (
            t('Загруженный материал', 'Жүктелген материал')
          )}
        </p>
        <p>{e.name}</p>
        <code>SHA-256: {e.sha256}</code>
      </details>
      {e.mime.startsWith('image/') && (
        <dialog
          ref={dialog}
          className="image-dialog"
          onClick={(event) => {
            if (event.target === event.currentTarget) dialog.current?.close();
          }}
        >
          <div>
            <button className="secondary" autoFocus onClick={() => dialog.current?.close()}>
              <X size={17} />
              {t('Закрыть', 'Жабу')}
            </button>
            <p>{materialLabel(c, e, lang)}</p>
            <img src={href(c, e)} alt={materialLabel(c, e, lang)} />
          </div>
        </dialog>
      )}
    </div>
  );
}
