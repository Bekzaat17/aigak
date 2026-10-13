import {
  ArrowRight,
  ArrowUpRight,
  File,
  FileCheck2,
  FileText,
  FolderArchive,
  Globe2,
  Link2,
  Loader2,
  LockKeyhole,
  MessageSquareText,
  Search,
  Settings2,
  Sparkles,
  Upload,
  X,
} from 'lucide-react';
import { levels } from '../../shared/inspection';
import { size } from '../lib/format.ts';
import type { AppController } from './useAppController.ts';
type Props = Pick<
  AppController,
  | 'lang'
  | 't'
  | 'mode'
  | 'setMode'
  | 'url'
  | 'setUrl'
  | 'text'
  | 'setText'
  | 'files'
  | 'setFiles'
  | 'current'
  | 'busy'
  | 'ai'
  | 'analysisLevel'
  | 'setAnalysisLevel'
  | 'setDrawer'
  | 'templates'
  | 'templateId'
  | 'setTemplateId'
  | 'drag'
  | 'setDrag'
  | 'uploadRef'
  | 'openDemo'
  | 'addFiles'
  | 'start'
>;
export function IntakeScreen({
  lang,
  t,
  mode,
  setMode,
  url,
  setUrl,
  text,
  setText,
  files,
  setFiles,
  busy,
  ai,
  analysisLevel,
  setAnalysisLevel,
  setDrawer,
  templates,
  templateId,
  setTemplateId,
  drag,
  setDrag,
  uploadRef,
  openDemo,
  addFiles,
  start,
}: Props) {
  return (
    <>
      <section className="hero">
        <div className="eyebrow">
          <span className="live-dot" />
          {t('АНАЛИЗ ИГОРНОГО КОНТЕНТА', 'ҚҰМАР ОЙЫН МАЗМҰНЫН ТАЛДАУ')}
        </div>
        <h1>
          {t('От ссылки —', 'Сілтемеден —')}
          <br />
          <span>{t('к доказательствам.', 'дәлелдерге.')}</span>
        </h1>
        <p>
          {t(
            'Добавьте материал. Получите анализ, подтверждающие',
            'Материал қосыңыз. Талдау, растайтын үзінділер',
          )}
          <br className="desktop-break" />
          {t(
            ' фрагменты и готовый проект пакета документов.',
            ' және құжаттар пакетінің дайын жобасын алыңыз.',
          )}
        </p>
      </section>
      <form className="intake-card" onSubmit={start}>
        <div className="input-tabs" role="tablist">
          {(
            [
              { id: 'url', icon: Link2, label: t('Ссылка', 'Сілтеме') },
              {
                id: 'file',
                icon: Upload,
                label: t('Файл или скриншот', 'Файл немесе скриншот'),
              },
              { id: 'text', icon: FileText, label: t('Текст', 'Мәтін') },
            ] as const
          ).map((m) => (
            <button
              key={m.id}
              type="button"
              role="tab"
              aria-selected={mode === m.id}
              className={mode === m.id ? 'active' : ''}
              onClick={() => setMode(m.id)}
            >
              <m.icon size={18} />
              {m.label}
            </button>
          ))}
        </div>
        <div className="input-area">
          {mode === 'url' && (
            <>
              <label htmlFor="source-url">
                {t('Адрес страницы для проверки', 'Тексерілетін беттің мекенжайы')}
              </label>
              <div className="url-field">
                <Globe2 size={22} />
                <input
                  id="source-url"
                  type="text"
                  inputMode="url"
                  required
                  placeholder={t(
                    'example.com или https://example.com',
                    'example.com немесе https://example.com',
                  )}
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                  autoComplete="off"
                />
                <span className="key-hint">URL</span>
              </div>
              <p className="field-hint">
                {t(
                  'Можно вставить домен без https:// или полную ссылку.',
                  'https:// жоқ доменді немесе толық сілтемені қоюға болады.',
                )}
              </p>
            </>
          )}
          {mode === 'file' && (
            <>
              <input
                ref={uploadRef}
                type="file"
                multiple
                hidden
                onChange={(e) => {
                  addFiles(Array.from(e.target.files || []));
                  e.target.value = '';
                }}
              />
              <button
                className={`dropzone ${drag ? 'dragging' : ''}`}
                type="button"
                onClick={() => uploadRef.current?.click()}
                onDragOver={(e) => {
                  e.preventDefault();
                  setDrag(true);
                }}
                onDragLeave={() => setDrag(false)}
                onDrop={(e) => {
                  e.preventDefault();
                  setDrag(false);
                  addFiles(Array.from(e.dataTransfer.files));
                }}
                onPaste={(e) => {
                  const f = Array.from(e.clipboardData.files);
                  if (f.length) {
                    e.preventDefault();
                    addFiles(f);
                  }
                }}
              >
                <span className="upload-icon">
                  <Upload size={24} />
                </span>
                <strong>
                  {t(
                    'Перетащите файлы или выберите на устройстве',
                    'Файлдарды сүйреңіз немесе құрылғыдан таңдаңыз',
                  )}
                </strong>
                <span>
                  {t(
                    'PDF, изображения, TXT, HTML · до 5 файлов по 10 МБ',
                    'PDF, кескіндер, TXT, HTML · әрқайсысы 10 МБ-қа дейін 5 файл',
                  )}
                </span>
              </button>
              {files.length > 0 && (
                <div className="file-list">
                  {files.map((f, i) => (
                    <div key={i}>
                      <File size={17} />
                      <span>
                        {f.name}
                        <small>{size(f.size)}</small>
                      </span>
                      <button
                        type="button"
                        aria-label={t('Удалить файл', 'Файлды жою')}
                        onClick={() => setFiles(files.filter((_, n) => n !== i))}
                      >
                        <X size={16} />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}
          {mode === 'text' && (
            <>
              <label htmlFor="source-text">{t('Текст материала', 'Материал мәтіні')}</label>
              <textarea
                id="source-text"
                required
                value={text}
                maxLength={180000}
                onChange={(e) => setText(e.target.value)}
                rows={5}
                placeholder={t(
                  'Вставьте текст публикации или страницы…',
                  'Жарияланым немесе бет мәтінін қойыңыз…',
                )}
              />
              <p className="field-hint">
                {t(
                  'Сохраним исходный текст и выделим фрагменты с признаками.',
                  'Бастапқы мәтінді сақтап, белгілері бар үзінділерді бөлеміз.',
                )}
              </p>
            </>
          )}
        </div>
        <div className="intake-options">
          <div className="template-select">
            <FileCheck2 size={17} />
            <label htmlFor="template-select">{t('Шаблон', 'Үлгі')}</label>
            <select
              id="template-select"
              value={templateId}
              onChange={(e) => setTemplateId(e.target.value)}
            >
              {templates.map((a) => (
                <option value={a.id} key={a.id}>
                  {a.id === 'builtin' ? t('Базовый aigak', 'aigak негізгі үлгісі') : a.name}
                </option>
              ))}
            </select>
            <button
              type="button"
              className="icon-button"
              aria-label={t('Управление шаблонами', 'Үлгілерді басқару')}
              onClick={() => setDrawer('templates')}
            >
              <Settings2 size={17} />
            </button>
          </div>
        </div>
        <fieldset className="level-selector">
          <legend>{t('Глубина проверки', 'Тексеру тереңдігі')}</legend>
          <div>
            {levels.map((level) => (
              <label key={level.id} className={analysisLevel === level.id ? 'selected' : ''}>
                <input
                  type="radio"
                  name="analysis-level"
                  value={level.id}
                  checked={analysisLevel === level.id}
                  onChange={() => setAnalysisLevel(level.id)}
                />
                <strong>{level.name[lang]}</strong>
                <span>{level.description[lang]}</span>
              </label>
            ))}
          </div>
        </fieldset>
        {analysisLevel !== 'basic' && (
          <p className="ai-disclosure">
            {ai
              ? t(
                  'Извлечённый текст передаётся настроенному ИИ-сервису. Число этапов зависит от глубины проверки.',
                  'Алынған мәтін бапталған AI сервисіне жіберіледі. Кезеңдер саны тексеру тереңдігіне байланысты.',
                )
              : t(
                  'ИИ не подключён: выполнятся локальные проверки, результат будет частичным.',
                  'AI қосылмаған: жергілікті тексерулер орындалады, нәтиже ішінара болады.',
                )}
          </p>
        )}
        <div className="intake-bottom">
          <span>
            <LockKeyhole size={15} />
            {t('Оригиналы хранятся локально', 'Түпнұсқалар жергілікті сақталады')}
          </span>
          <button
            className="primary"
            disabled={busy || (mode === 'file' && !files.length)}
            type="submit"
          >
            {busy ? <Loader2 className="spin" size={18} /> : <Sparkles size={18} />}{' '}
            {t('Анализировать', 'Талдау')}
            <ArrowRight size={18} />
          </button>
        </div>
      </form>
      <div className="demo-row">
        <span>
          {t('Хотите сначала посмотреть результат?', 'Алдымен нәтижені көргіңіз келе ме?')}
        </span>
        <button disabled={busy} onClick={() => void openDemo()}>
          {t('Открыть пример', 'Мысалды ашу')}
          <ArrowUpRight size={15} />
        </button>
      </div>
      <section className="steps">
        {[
          {
            icon: Search,
            n: '01',
            title: t('Проверяем материал', 'Материалды тексереміз'),
            body: t(
              'Извлекаем текст и находим признаки игорного предложения.',
              'Мәтінді алып, ойын ұсынысының белгілерін іздейміз.',
            ),
          },
          {
            icon: MessageSquareText,
            n: '02',
            title: t('Уточняем вместе', 'Бірге нақтылаймыз'),
            body: t(
              'Показываем источники и задаём вопросы там, где нужна ваша оценка.',
              'Дереккөздерді көрсетіп, сіздің бағаңыз қажет жерде сұрақ қоямыз.',
            ),
          },
          {
            icon: FolderArchive,
            n: '03',
            title: t('Собираем пакет', 'Пакетті жинаймыз'),
            body: t(
              'Документы по вашему шаблону, оригиналы и опись — в одном архиве.',
              'Үлгіңіз бойынша құжаттар, түпнұсқалар мен тізімдеме — бір мұрағатта.',
            ),
          },
        ].map((s) => (
          <article key={s.n}>
            <div>
              <s.icon size={21} />
              <span>{s.n}</span>
            </div>
            <h3>{s.title}</h3>
            <p>{s.body}</p>
          </article>
        ))}
      </section>
    </>
  );
}
