import {
  ArrowUpRight,
  Check,
  Download,
  FileCheck2,
  FileText,
  Globe2,
  Loader2,
  Search,
  Sparkles,
  Upload,
  X,
} from 'lucide-react';
import { date } from '../lib/format.ts';
import type { AppController } from './useAppController.ts';
type Props = Pick<
  AppController,
  | 'lang'
  | 't'
  | 'files'
  | 'current'
  | 'records'
  | 'busy'
  | 'error'
  | 'ai'
  | 'drawer'
  | 'setDrawer'
  | 'templates'
  | 'templateFields'
  | 'templateId'
  | 'setTemplateId'
  | 'query'
  | 'setQuery'
  | 'templateRef'
  | 'openSavedCase'
  | 'changeTemplate'
  | 'errMessage'
>;
export function AppDrawer({
  lang,
  t,
  records,
  busy,
  error,
  ai,
  drawer,
  setDrawer,
  templates,
  templateFields,
  templateId,
  setTemplateId,
  query,
  setQuery,
  templateRef,
  openSavedCase,
  changeTemplate,
  errMessage,
}: Props) {
  return (
    drawer && (
      <div className="overlay" onClick={() => setDrawer(null)}>
        <section
          className="drawer"
          role="dialog"
          aria-modal="true"
          aria-label={
            drawer === 'history'
              ? t('История', 'Тарих')
              : drawer === 'templates'
                ? t('Шаблоны', 'Үлгілер')
                : t('Как это работает', 'Қалай жұмыс істейді')
          }
          onClick={(e) => e.stopPropagation()}
        >
          <button
            className="close-drawer icon-button"
            aria-label={t('Закрыть', 'Жабу')}
            onClick={() => setDrawer(null)}
          >
            <X size={22} />
          </button>
          {drawer === 'history' ? (
            <>
              <div className="eyebrow">
                {t('ВАШЕ РАБОЧЕЕ ПРОСТРАНСТВО', 'СІЗДІҢ ЖҰМЫС КЕҢІСТІГІҢІЗ')}
              </div>
              <h2>{t('История анализов', 'Талдаулар тарихы')}</h2>
              <div className="search-field">
                <Search size={18} />
                <input
                  aria-label={t('Поиск', 'Іздеу')}
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder={t(
                    'Найти по названию или номеру',
                    'Атауы немесе нөмірі бойынша іздеу',
                  )}
                />
              </div>
              <div className="history-list">
                {records
                  .filter((r) => (r.title + r.number).toLowerCase().includes(query.toLowerCase()))
                  .map((r) => (
                    <button key={r.id} onClick={() => void openSavedCase(r.id)}>
                      <div className="file-icon">
                        {r.sourceType === 'url' ? <Globe2 size={22} /> : <FileText size={22} />}
                      </div>
                      <div>
                        <strong>{r.title}</strong>
                        <span>
                          {r.number} · {date(r.createdAt, lang)}
                        </span>
                        <small>
                          {r.demo
                            ? t('Учебный пример', 'Оқу мысалы')
                            : r.status === 'verified'
                              ? t('Проверено', 'Тексерілген')
                              : r.step[lang]}
                        </small>
                      </div>
                      <ArrowUpRight size={18} />
                    </button>
                  ))}
                {!!records.length &&
                  !records.some((r) =>
                    (r.title + r.number).toLowerCase().includes(query.toLowerCase()),
                  ) && (
                    <p className="empty-history">
                      {t(
                        'Ничего не найдено. Попробуйте другое название или номер.',
                        'Ештеңе табылмады. Басқа атау не нөмір енгізіңіз.',
                      )}
                    </p>
                  )}
                {!records.length && (
                  <p className="empty-history">
                    {t(
                      'Здесь появятся ваши анализы. Начните со ссылки или файла.',
                      'Талдауларыңыз осында пайда болады. Сілтемеден немесе файлдан бастаңыз.',
                    )}
                  </p>
                )}
              </div>
            </>
          ) : drawer === 'templates' ? (
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
              <button
                className="primary full"
                disabled={busy}
                onClick={() => templateRef.current?.click()}
              >
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
          ) : (
            <>
              <div className="eyebrow">AIGAK / MVP</div>
              <h2>{t('От материала до пакета', 'Материалдан пакетке дейін')}</h2>
              {[
                t(
                  '1. Добавьте публичную ссылку, изображение, PDF или текст. Оригиналы сохраняются на этом компьютере.',
                  '1. Ашық сілтеме, кескін, PDF немесе мәтін қосыңыз. Түпнұсқалар осы компьютерде сақталады.',
                ),
                t(
                  '2. Анализ находит признаки и точные цитаты. Если подключён AI, его процент — предварительная оценка наличия игорного предложения, а не вероятности нарушения закона.',
                  '2. Талдау белгілер мен нақты дәйексөздерді табады. AI қосылса, оның пайызы — заң бұзушылық ықтималдығы емес, ойын ұсынысының алдын ала бағасы.',
                ),
                t(
                  '3. Подтвердите или отклоните признаки, ответьте на вопросы о контексте. Каждый ответ попадёт в журнал.',
                  '3. Белгілерді растаңыз не қабылдамаңыз, мәнмәтін сұрақтарына жауап беріңіз. Әр жауап журналға жазылады.',
                ),
                t(
                  '4. Скачайте ZIP с документами по шаблону и исходными материалами. Проект проверяет и подписывает ответственный сотрудник.',
                  '4. Үлгі бойынша құжаттар мен бастапқы материалдары бар ZIP жүктеңіз. Жобаны жауапты қызметкер тексеріп, қол қояды.',
                ),
              ].map((s, i) => (
                <p className="help-paragraph" key={i}>
                  {s}
                </p>
              ))}
              <div className="template-guide">
                <Sparkles size={22} />
                <h3>{ai ? t('AI подключён', 'AI қосылған') : t('Подключение AI', 'AI қосу')}</h3>
                <p>
                  {t(
                    'AI включается отдельно для каждого анализа. Администратор задаёт OPENAI_API_KEY и OPENAI_MODEL в серверном .env и перезапускает приложение. Без ключа доступны локальные правила и OCR.',
                    'AI әр талдау үшін бөлек қосылады. Әкімші сервердегі .env файлына OPENAI_API_KEY және OPENAI_MODEL енгізіп, қолданбаны қайта іске қосады. Кілтсіз жергілікті ережелер мен OCR қолжетімді.',
                  )}
                </p>
              </div>
            </>
          )}
        </section>
      </div>
    )
  );
}
