import { useState } from 'react';
import type { CaseRecord, Lang } from '../../../shared/types';
import { useCaseMutation } from '../../hooks/useCaseMutation';
export function useLegalReview(c: CaseRecord, lang: Lang, onChange: (record: CaseRecord) => void) {
  const mutate = useCaseMutation(c.id, onChange);
  const t = (ru: string, kk: string) => (lang === 'ru' ? ru : kk);
  const [value, setValue] = useState(
    c.legalReview || {
      eventDate: '',
      officer: c.officer,
      note: (
        c.inspection?.stages
          .flatMap((s) => s.legalHypotheses || [])
          .map((h) => {
            const norm = c.osint?.legalNorms?.find((n) => n.id === h.normId);
            return [
              norm?.title?.[lang] || t('Об игорном бизнесе', 'Ойын бизнесі туралы'),
              t('Статья', 'Бап') + ' ' + norm?.article,
              h.reason[lang],
              norm?.sourceUrl,
              ...h.missing.map((m) => t('Проверить', 'Тексеру') + ': ' + m[lang]),
            ]
              .filter(Boolean)
              .join('\n');
          })
          .join('\n\n') || ''
      ).slice(0, 5000),
      jurisdictionConfirmed: false,
      editionConfirmed: false,
    },
  );
  const [status, setStatus] = useState('');
  const save = async () => {
    setStatus('saving');
    try {
      await mutate('legal-review', value);
      setStatus('saved');
    } catch {
      setStatus('error');
    }
  };
  return { value, setValue, status, save };
}
