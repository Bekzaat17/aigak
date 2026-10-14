import type { CaseRecord, Lang } from '../../../shared/types';
import { translator } from '../../i18n/translate.ts';
import { Check, Download, FolderArchive } from 'lucide-react';
type Props = {
  current: Pick<CaseRecord, 'status' | 'evidence'>;
  lang: Lang;
  busy: boolean;
  exportZip: () => Promise<void>;
};
export function PackageDownloadCard({ current, lang, busy, exportZip }: Props) {
  const t = translator(lang);
  return (
    <div className="aside-card package-card">
      <FolderArchive size={28} />
      <h3>{t('Всё в одном архиве', 'Барлығы бір мұрағатта')}</h3>
      <ul>
        {[
          t('DOCX по выбранному шаблону', 'Таңдалған үлгі бойынша DOCX'),
          t('Отчёты RU / KK в PDF и HTML', 'PDF және HTML есептері RU / KK'),
          t('Оригиналы и извлечённый текст', 'Түпнұсқалар және алынған мәтін'),
          t('Опись SHA-256 и журнал', 'SHA-256 тізімдемесі және журнал'),
        ].map((s) => (
          <li key={s}>
            <Check size={16} />
            {s}
          </li>
        ))}
      </ul>
      <div className="package-status">
        <span className="live-dot" />
        {current.status === 'verified'
          ? t('Проверено · проект документа', 'Тексерілген · құжат жобасы')
          : t('Проект · требуется проверка', 'Жоба · тексеру қажет')}
      </div>
      <button
        className="primary"
        disabled={busy || !current.evidence.length}
        onClick={() => void exportZip()}
      >
        <Download size={17} />
        {t('Скачать ZIP', 'ZIP жүктеу')}
      </button>
      <small>
        {t(
          'Можно скачать проект до завершения проверки. Официальная форма требует согласования.',
          'Тексеру аяқталмай тұрып жобаны жүктеуге болады. Ресми нысан келісуді қажет етеді.',
        )}
      </small>
    </div>
  );
}
