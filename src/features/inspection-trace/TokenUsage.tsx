import type { AiAttempt, Lang } from '../../../shared/types';
import { summarizeAiUsage } from '../../../shared/ai-usage';
import { translator } from '../../i18n/translate';

type Props = { attempts: AiAttempt[]; expectedAttempts?: number; lang: Lang };
export function TokenUsage({ attempts, expectedAttempts, lang }: Props) {
  const t = translator(lang);
  const usage = summarizeAiUsage(attempts, expectedAttempts);
  const format = (count: number, missing: number) =>
    missing && !count
      ? t('нет данных', 'дерек жоқ')
      : `${missing ? '≥ ' : ''}${count.toLocaleString(lang === 'ru' ? 'ru-RU' : 'kk-KZ')}`;
  return (
    <span className="token-usage">
      <span>
        {t('Токены', 'Токендер')}:{' '}
        <strong>
          {format(usage.inputTokens + usage.outputTokens, usage.missingUsageAttempts)}
        </strong>
      </span>
      <span>
        {t('Вход', 'Кіріс')}: {format(usage.inputTokens, usage.missingInput)}
      </span>
      <span>
        {t('Выход', 'Шығыс')}: {format(usage.outputTokens, usage.missingOutput)}
      </span>
      {usage.missingUsageAttempts > 0 && (
        <span>
          {t('Расход известен не для всех попыток', 'Барлық әрекеттердің шығыны белгілі емес')}
        </span>
      )}
    </span>
  );
}
