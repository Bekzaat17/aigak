import type { Lang } from '../../../shared/types';
import type { PublicAuthProfile } from '../../../shared/authentication';
export interface AuthenticationOptionsProps {
  profiles: PublicAuthProfile[];
  profileId: string;
  setProfileId: (id: string) => void;
  mode: 'login' | 'register';
  setMode: (mode: 'login' | 'register') => void;
}
export function AuthenticationOptions({
  lang,
  profiles,
  profileId,
  setProfileId,
  mode,
  setMode,
}: AuthenticationOptionsProps & { lang: Lang }) {
  const t = (ru: string, kk: string) => (lang === 'ru' ? ru : kk);
  const profile = profiles.find((p) => p.id === profileId);
  return (
    <details className="technical-details">
      <summary>{t('Проверка после входа · Pro', 'Кіргеннен кейін тексеру · Pro')}</summary>
      <p>
        {t(
          'Агент использует подготовленный профиль для входа или регистрации, затем проверяет разрешённые внутренние страницы. В отчёте они отмечаются отдельно.',
          'Агент дайын профильмен кіріп немесе тіркеліп, рұқсат етілген ішкі беттерді тексереді. Есепте олар бөлек белгіленеді.',
        )}
      </p>
      {profiles.length ? (
        <>
          <label>
            {t('Учётная запись', 'Тіркелгі')}
            <select
              value={profileId}
              onChange={(e) => {
                setProfileId(e.target.value);
                setMode('login');
              }}
            >
              <option value="">{t('Только публичная часть', 'Тек ашық бөлім')}</option>
              {profiles.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name} · {p.origin}
                </option>
              ))}
            </select>
          </label>
          {profile && (
            <label>
              {t('Сценарий', 'Сценарий')}
              <select
                value={mode}
                onChange={(e) => setMode(e.target.value as 'login' | 'register')}
              >
                <option value="login">{t('Войти в аккаунт', 'Тіркелгіге кіру')}</option>
                {profile.registration && (
                  <option value="register">
                    {t('Создать аккаунт и войти', 'Тіркелгі жасап кіру')}
                  </option>
                )}
              </select>
            </label>
          )}
        </>
      ) : (
        <p>
          {t(
            'Профиль доступа ещё не подключён. Пока проверяется публичная часть сайта.',
            'Кіру профилі қосылмаған. Әзірге сайттың ашық бөлімі тексеріледі.',
          )}
        </p>
      )}
      <p>
        {t(
          'При неподдерживаемой форме, CAPTCHA или 2FA результат укажет, какое действие требуется. Ставки, платежи и изменение профиля не выполняются.',
          'Қолдау көрсетілмейтін нысан, CAPTCHA немесе 2FA болса, қажетті әрекет көрсетіледі. Бәс тігу, төлемдер және профильді өзгерту орындалмайды.',
        )}
      </p>
    </details>
  );
}
