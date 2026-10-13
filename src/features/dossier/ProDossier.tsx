import { buildDossier } from '../../../shared/dossier';
import type { CaseRecord, Lang } from '../../../shared/types';

export function ProDossier({
  c,
  lang,
  onReview,
}: {
  c: CaseRecord;
  lang: Lang;
  onReview: () => void;
}) {
  const dossier = buildDossier(c);
  const t = (ru: string, kk: string) => (lang === 'ru' ? ru : kk);
  return (
    <section className="panel pro-dossier">
      <div className="workspace-heading">
        <div>
          <h2>{t('Досье для инспектора', 'Инспекторға арналған досье')}</h2>
          <p>
            {dossier.ready
              ? t(
                  'Материалы подготовлены к итоговой проверке и оформлению обращения.',
                  'Материалдар қорытынды тексеру мен өтінішті рәсімдеуге дайын.',
                )
              : t(
                  'Проект собран. Ниже — что установлено и что ещё нужно проверить.',
                  'Жоба жиналды. Төменде анықталған және тексеруді қажет ететін мәліметтер.',
                )}
          </p>
        </div>
        <button className="secondary" onClick={onReview}>
          {t('Завершить проверку', 'Тексеруді аяқтау')}
        </button>
      </div>
      <div className="dossier-tasks">
        {dossier.tasks.map((task) => (
          <details key={task.id}>
            <summary>
              <span className={'task-dot ' + task.status} />
              <span>{task.title[lang]}</span>
              <small>
                {task.status === 'done'
                  ? t('Проверено', 'Тексерілді')
                  : task.status === 'review'
                    ? t('Сверить', 'Салыстыру')
                    : t('Нужны данные', 'Дерек қажет')}
              </small>
            </summary>
            <p>{task.detail[lang]}</p>
          </details>
        ))}
      </div>
    </section>
  );
}
