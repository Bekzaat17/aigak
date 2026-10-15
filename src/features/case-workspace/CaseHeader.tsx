import type { CaseRecord, Lang } from '../../../shared/types';
import { translator } from '../../i18n/translate.ts';
import { ArrowLeft, Download, Loader2 } from 'lucide-react';
import { date } from '../../lib/format.ts';
type Props = {
  current: Pick<CaseRecord, 'number' | 'title' | 'createdAt' | 'demo' | 'evidence'>;
  lang: Lang;
  busy: boolean;
  processing: boolean | null;
  reset: () => void;
  exportZip: () => Promise<void>;
};
export function CaseHeader({ current, lang, busy, processing, reset, exportZip }: Props) {
  const t = translator(lang);
  return (
    <>
      {' '}
      <div className="result-nav">
        <button className="text-button" onClick={reset}>
          <ArrowLeft size={16} />
          {t('Новый анализ', 'Жаңа талдау')}
        </button>
        <span className="mono">{current.number}</span>
      </div>
      <div className="result-heading">
        <div>
          <div className="eyebrow">
            {processing
              ? t('ПРОВЕРКА ВЫПОЛНЯЕТСЯ', 'ТЕКСЕРУ ОРЫНДАЛУДА')
              : t('РЕЗУЛЬТАТ ПРОВЕРКИ', 'ТЕКСЕРУ НӘТИЖЕСІ')}
          </div>
          <h1>{current.title}</h1>
          <p>
            {date(current.createdAt, lang)} · {t('Время Алматы', 'Алматы уақыты')}{' '}
            {current.demo && (
              <span className="demo-badge">{t('Учебный пример', 'Оқу мысалы')}</span>
            )}
          </p>
        </div>
        <button
          className="primary"
          disabled={busy || !!processing || !current.evidence.length}
          onClick={() => void exportZip()}
        >
          {busy ? <Loader2 size={18} className="spin" /> : <Download size={18} />}{' '}
          {t('Скачать проект пакета', 'Пакет жобасын жүктеу')}
        </button>
      </div>
    </>
  );
}
