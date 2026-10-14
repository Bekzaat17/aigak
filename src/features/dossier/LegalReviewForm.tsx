import type { CaseRecord, Lang } from '../../../shared/types';
import { useLegalReview } from './useLegalReview.ts';

export function LegalReviewForm({
  c,
  lang,
  onChange,
}: {
  c: CaseRecord;
  lang: Lang;
  onChange: (c: CaseRecord) => void;
}) {
  const { value, setValue, status, save } = useLegalReview(c, lang, onChange);
  const t = (ru: string, kk: string) => (lang === 'ru' ? ru : kk);
  return (
    <section className="panel legal-review">
      <h3>
        {t('Проверка правового основания инспектором', 'Инспектордың құқықтық негізді тексеруі')}
      </h3>
      <p>
        {t(
          'Сверьте норму и её редакцию на дату события в официальном источнике. Опишите территориальную связь с РК, условия применения и оставшиеся ограничения.',
          'Норма мен оқиға күніндегі редакциясын ресми дереккөзден салыстырыңыз. ҚР-мен аумақтық байланысты, қолдану шарттары мен шектеулерді сипаттаңыз.',
        )}
      </p>
      <label>
        {t('Дата события', 'Оқиға күні')}
        <input
          type="date"
          value={value.eventDate}
          onChange={(e) => setValue({ ...value, eventDate: e.target.value })}
        />
      </label>
      <label>
        {t('Проверяющий', 'Тексеруші')}
        <input
          value={value.officer}
          onChange={(e) => setValue({ ...value, officer: e.target.value })}
          maxLength={150}
        />
      </label>
      <label className="evidence-choice">
        <input
          type="checkbox"
          checked={value.jurisdictionConfirmed}
          onChange={(e) => setValue({ ...value, jurisdictionConfirmed: e.target.checked })}
        />
        <span>
          {t(
            'Основания применения к территории РК проверены',
            'ҚР аумағына қолдану негіздері тексерілді',
          )}
        </span>
      </label>
      <label className="evidence-choice">
        <input
          type="checkbox"
          checked={value.editionConfirmed}
          onChange={(e) => setValue({ ...value, editionConfirmed: e.target.checked })}
        />
        <span>
          {t(
            'Редакция, условия и исключения проверены',
            'Редакция, шарттар мен ерекшеліктер тексерілді',
          )}
        </span>
      </label>
      <label>
        {t('Основание, источники и порядок обращения', 'Негіздеме, дереккөздер және өтініш рәсімі')}
        <textarea
          rows={5}
          value={value.note}
          onChange={(e) => setValue({ ...value, note: e.target.value })}
          maxLength={5000}
        />
      </label>
      <button
        className="secondary"
        disabled={
          status === 'saving' ||
          !value.eventDate ||
          value.officer.trim().length < 2 ||
          value.note.trim().length < 10
        }
        onClick={() => void save()}
      >
        {t('Сохранить правовую проверку', 'Құқықтық тексеруді сақтау')}
      </button>
      {status === 'saved' && <p>{t('Сохранено', 'Сақталды')}</p>}
      {status === 'error' && (
        <p role="alert">
          {t(
            'Не удалось сохранить. Проверьте поля.',
            'Сақтау мүмкін болмады. Өрістерді тексеріңіз.',
          )}
        </p>
      )}
    </section>
  );
}
