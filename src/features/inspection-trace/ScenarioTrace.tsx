import type { ScenarioRun } from '../../../shared/agent-run';
import type { Lang } from '../../../shared/types';
export function ScenarioTrace({ run, lang }: { run: ScenarioRun; lang: Lang }) {
  const t = (ru: string, kk: string) => (lang === 'ru' ? ru : kk);
  const names: Record<string, string> = {
    'collection-v2': t('Сбор материалов', 'Материал жинау'),
    'resource-profile-v1': t('Паспорт ресурса', 'Ресурс паспорты'),
    'pro-enrichment-v1': t('Законы и связи', 'Заңдар мен байланыстар'),
    'inspection-v1': t('Анализ признаков', 'Белгілерді талдау'),
    'finding-verification-v1': t('Проверка доказательств', 'Дәлелдерді тексеру'),
    'observe-controls': t(
      'Поиск элементов браузерным агентом',
      'Браузер агентімен элементтерді іздеу',
    ),
  };
  return (
    <section>
      <h3>{t('Оркестратор и запасные сценарии', 'Оркестратор және қосалқы сценарийлер')}</h3>
      <p>
        {run.status === 'completed'
          ? t('Завершено', 'Аяқталды')
          : run.status === 'partial'
            ? t('Частичный результат', 'Ішінара нәтиже')
            : t('Выполняется', 'Орындалуда')}{' '}
        · {t('Общий бюджет: 400 с', 'Жалпы уақыт: 400 с')}
      </p>
      <ol>
        {run.actions.map((a, i) => (
          <li key={i}>
            <strong>{names[a.action] || a.action}</strong> · {(a.durationMs / 1000).toFixed(1)}{' '}
            {t('с', 'с')} ·{' '}
            {a.status === 'completed'
              ? t('Проверено', 'Тексерілді')
              : a.status === 'rejected'
                ? t('Нужен запасной способ', 'Қосалқы тәсіл қажет')
                : t('Не завершено', 'Аяқталмады')}
            {a.reason && <div>{a.reason}</div>}
            {a.model && (
              <div>
                {a.model} · {t('Токены вход / выход', 'Кіріс / шығыс токендері')}:{' '}
                {a.inputTokens ?? '—'} / {a.outputTokens ?? '—'} · {t('Стоимость', 'Құны')}:{' '}
                {a.costUsd == null
                  ? t('тариф не задан', 'тариф берілмеген')
                  : '$' + a.costUsd.toFixed(5)}
              </div>
            )}
          </li>
        ))}
      </ol>
    </section>
  );
}
