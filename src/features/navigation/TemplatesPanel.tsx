import type { Lang } from '../../../shared/types';
import { translator } from '../../i18n/translate.ts';
import { FileCheck2, Download, Loader2, Upload, FileText, Check } from 'lucide-react';
import type { RefObject } from 'react';
export interface TemplatesPanelProps {
  lang: Lang;
  busy: boolean;
  error: string;
  errMessage: string;
  templates: { id: string; name: string }[];
  templateFields: string[];
  templateId: string;
  setTemplateId: (id: string) => void;
  templateRef: RefObject<HTMLInputElement | null>;
  changeTemplate: (file: File) => Promise<void>;
}
export function TemplatesPanel({
  lang,
  busy,
  error,
  errMessage,
  templates,
  templateFields,
  templateId,
  setTemplateId,
  templateRef,
  changeTemplate,
}: TemplatesPanelProps) {
  const t = translator(lang);

  return (
    <>
      <div className="eyebrow">DOCX · RU / KK</div>
      <h2>{t('Ваш формат документов', 'Сіздің құжат пішіміңіз')}</h2>
      <p>
        {t(
          'Используйте базовый шаблон или загрузите форму вашей организации с полями для подстановки.',
          'Негізгі үлгіні пайдаланыңыз немесе ұйымыңыздың толтырылатын өрістері бар нысанын жүктеңіз.',
        )}
      </p>
      <div className="template-guide">
        <FileCheck2 size={25} />
        <h3>{t('Начните с базового шаблона', 'Негізгі үлгіден бастаңыз')}</h3>
        <p>
          {t(
            'Скачайте, измените оформление в Word и загрузите обратно. Поля в фигурных скобках сохранят связь с анализом.',
            'Жүктеп алып, Word-та безендіруін өзгертіп, қайта жүктеңіз. Фигуралы жақшадағы өрістер талдаумен байланысты сақтайды.',
          )}
        </p>
        <a className="secondary" href="/api/templates/builtin" download>
          <Download size={16} />
          {t('Скачать шаблон', 'Үлгіні жүктеу')}
        </a>
      </div>
      <input
        type="file"
        accept=".docx"
        hidden
        ref={templateRef}
        onChange={(e) => {
          if (e.target.files?.[0]) void changeTemplate(e.target.files[0]);
          e.target.value = '';
        }}
      />
      <button className="primary full" disabled={busy} onClick={() => templateRef.current?.click()}>
        {busy ? <Loader2 size={17} className="spin" /> : <Upload size={17} />}{' '}
        {t('Загрузить свой DOCX', 'Өз DOCX үлгісін жүктеу')}
      </button>
      <p className="field-hint">
        {t(
          'До 2 МБ · без макросов, вложений и внешних связей',
          '2 МБ-қа дейін · макроссыз, тіркемесіз және сыртқы байланыссыз',
        )}
      </p>
      {error && (
        <p className="inline-error" role="alert">
          {errMessage}
        </p>
      )}
      <div className="saved-templates">
        {templates.map((a) => (
          <button
            className={templateId === a.id ? 'selected' : ''}
            key={a.id}
            onClick={() => setTemplateId(a.id)}
          >
            <FileText size={17} />
            <span>{a.name}</span>
            {templateId === a.id && <Check size={17} />}
          </button>
        ))}
      </div>
      <h3>{t('Доступные поля', 'Қолжетімді өрістер')}</h3>
      <div className="template-tags">
        {templateFields.map((f) => (
          <code key={f}>{`{${f}}`}</code>
        ))}
      </div>
      <p className="field-hint">
        {t(
          'Обязательные: case_number, findings, evidence_list. Заголовки вашего шаблона сохраняются на исходном языке. PDF-отчёт имеет стандартное оформление.',
          'Міндетті: case_number, findings, evidence_list. Үлгі тақырыптары бастапқы тілде сақталады. PDF есебі стандартты безендіруде.',
        )}
      </p>
    </>
  );
}
