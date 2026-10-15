import type { Lang } from '../../../shared/types';
import { useAuthChallenge } from '../../hooks/useAuthChallenge';
export function AuthChallengePanel({
  id,
  active,
  lang,
}: {
  id: string;
  active: boolean;
  lang: Lang;
}) {
  const state = useAuthChallenge(id, active);
  if (!active || !state.challenge) return null;
  const t = (ru: string, kk: string) => (lang === 'ru' ? ru : kk);
  return (
    <section className="panel">
      <h3>{t('Сайт запросил код подтверждения', 'Сайт растау кодын сұрады')}</h3>
      <p>
        {t(
          'Введите полученный код. Агент продолжит в той же сессии; код не попадёт в отчёт.',
          'Алынған кодты енгізіңіз. Агент сол сессияда жалғастырады; код есепке кірмейді.',
        )}
      </p>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          void state.submit();
        }}
      >
        <input
          aria-label={t('Код подтверждения', 'Растау коды')}
          autoComplete="one-time-code"
          inputMode="numeric"
          type="password"
          pattern="[0-9]{4,10}"
          minLength={4}
          maxLength={10}
          required
          value={state.code}
          onChange={(e) => state.setCode(e.target.value.replace(/\D/g, ''))}
        />
        <button type="submit" disabled={state.sending}>
          {t('Продолжить', 'Жалғастыру')}
        </button>
      </form>
      {state.error && (
        <p role="alert">
          {t(
            'Код не принят или время ожидания истекло.',
            'Код қабылданбады немесе күту уақыты аяқталды.',
          )}
        </p>
      )}
    </section>
  );
}
