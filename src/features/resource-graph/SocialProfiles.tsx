import type { CaseRecord, Lang } from '../../../shared/types';
import { socialProfiles } from './resource-sections';
export function SocialProfiles({ current, lang }: { current: CaseRecord; lang: Lang }) {
  const t = (ru: string, kk: string) => (lang === 'ru' ? ru : kk);
  const profiles = socialProfiles(current);
  return (
    <section className="panel">
      <h3>{t('Соцсети и публичные каналы', 'Әлеуметтік желілер және ашық арналар')}</h3>
      <p>
        {t(
          'Ссылки, опубликованные на исследуемом сайте. Владение аккаунтами отдельно не подтверждено.',
          'Зерттелген сайтта жарияланған сілтемелер. Аккаунттардың тиесілілігі бөлек расталмады.',
        )}
      </p>
      {!profiles.length && (
        <p>
          {t(
            'В полученных материалах ссылки на профили не найдены.',
            'Алынған материалдарда профиль сілтемелері табылмады.',
          )}
        </p>
      )}
      {profiles.map((p) => (
        <article key={p.url}>
          <h4>
            <a href={p.url} target="_blank" rel="noreferrer">
              {new URL(p.url).hostname}
              {new URL(p.url).pathname}
            </a>
          </h4>
          {p.sourceUrl && (
            <a href={p.sourceUrl} target="_blank" rel="noreferrer">
              {t('Где опубликована ссылка', 'Сілтеме жарияланған жер')}
            </a>
          )}
        </article>
      ))}
    </section>
  );
}
