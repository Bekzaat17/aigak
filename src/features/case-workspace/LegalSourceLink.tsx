import type { LegalNorm } from '../../../shared/osint';
import type { Lang } from '../../../shared/types';

export function LegalSourceLink({ norm, lang }: { norm?: LegalNorm; lang: Lang }) {
  if (!norm)
    return (
      <span>
        {lang === 'ru' ? 'Официальный источник не установлен' : 'Ресми дереккөз анықталмаған'}
      </span>
    );
  const title = norm.title?.[lang] || norm.documentId || norm.id;
  return (
    <span className="legal-source-link">
      <a href={norm.sourceUrl} target="_blank" rel="noreferrer">
        {title} · {lang === 'ru' ? 'статья' : 'бап'} {norm.article}
      </a>
      <small>
        {' '}
        · {norm.documentId || norm.id} · {lang === 'ru' ? 'источник: Әділет' : 'дереккөз: Әділет'}
      </small>
    </span>
  );
}
