import { useState } from 'react';
import type { CaseRecord, Lang } from '../shared/types';
import { useCaseMutation } from './hooks/useCaseMutation';
export function PackagePreview({
  c,
  lang,
  templates,
  onChange,
}: {
  c: CaseRecord;
  lang: Lang;
  templates: { id: string; name: string }[];
  onChange: (c: CaseRecord) => void;
}) {
  const [open, setOpen] = useState(false);
  const [error, setError] = useState(false);
  const [busy, setBusy] = useState(false);
  const mutate = useCaseMutation(c.id, onChange);
  const t = (ru: string, kk: string) => (lang === 'ru' ? ru : kk);
  return (
    <section className="panel package-preview">
      <h3>{t('Оформление пакета', 'Пакетті рәсімдеу')}</h3>
      <label>
        {t('Шаблон документа', 'Құжат үлгісі')}
        <select
          value={c.templateId}
          disabled={busy}
          onChange={async (e) => {
            setBusy(true);
            setError(false);
            try {
              await mutate('template', { templateId: e.target.value });
            } catch {
              setError(true);
            } finally {
              setBusy(false);
            }
          }}
        >
          {templates.map((a) => (
            <option key={a.id} value={a.id}>
              {a.name}
            </option>
          ))}
        </select>
      </label>
      <p>
        {t(
          'Встроенный шаблон — проект. Для принятой формы выберите загруженный DOCX организации.',
          'Негізгі үлгі — жоба. Бекітілген нысан үшін ұйымның жүктелген DOCX үлгісін таңдаңыз.',
        )}
      </p>
      <a className="secondary" href={`/api/cases/${c.id}/document?lang=${lang}`} download>
        {t('Заполненный DOCX по шаблону', 'Үлгі бойынша толтырылған DOCX')}
      </a>
      <button className="secondary" onClick={() => setOpen(!open)}>
        {open
          ? t('Скрыть предпросмотр', 'Алдын ала қарауды жасыру')
          : t('Предпросмотр стандартного отчёта', 'Стандартты есепті алдын ала қарау')}
      </button>
      {error && <p role="alert">{t('Не удалось выбрать шаблон', 'Үлгі таңдалмады')}</p>}
      {open && (
        <>
          <p className="muted">
            {t(
              'Это стандартный HTML/PDF-отчёт. Оформление загруженного DOCX проверяйте в заполненном файле выше.',
              'Бұл стандартты HTML/PDF есебі. Жүктелген DOCX пішімін жоғарыдағы толтырылған файлдан тексеріңіз.',
            )}
          </p>
          <iframe
            title={t('Предпросмотр отчёта', 'Есепті алдын ала қарау')}
            sandbox=""
            src={`/api/cases/${c.id}/preview?lang=${lang}&version=${encodeURIComponent(c.updatedAt)}`}
          />
        </>
      )}
    </section>
  );
}
