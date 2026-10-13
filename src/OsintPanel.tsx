import { Building2, Contact, Download, Globe2, Network } from 'lucide-react';
import { maskPersonalIds, osintLabels } from '../shared/osint';
import { displayObservations } from '../shared/osint-presentation';
import type { CaseRecord, Lang } from '../shared/types';
import { ResourceGraph } from './ResourceGraph';
export function OsintPanel({
  current,
  lang,
  onChange,
}: {
  current: CaseRecord;
  lang: Lang;
  onChange?: (c: CaseRecord) => void;
}) {
  const r = current.osint;
  const t = (ru: string, kk: string) => (lang === 'ru' ? ru : kk);
  if (!r)
    return (
      <div className="empty-result">
        {t(
          'Сведения о ресурсе для этой проверки не собирались.',
          'Бұл тексеру үшін ресурс туралы мәліметтер жиналмады.',
        )}
      </div>
    );
  const clean = displayObservations(r.observations, lang);
  const groups = [
    {
      title: t('Контакты и реквизиты', 'Байланыстар мен деректемелер'),
      icon: Contact,
      description: t(
        'То, что опубликовано в материалах сайта. Принадлежность требует проверки.',
        'Сайт материалдарында жарияланған мәліметтер. Тиесілілігін тексеру қажет.',
      ),
      kinds: [
        'email',
        'phone',
        'social',
        'organization',
        'address',
        'business_id',
        'license',
        'sensitive_identifier',
      ],
    },
    {
      title: t('Регистрация и организация', 'Тіркеу және ұйым'),
      icon: Building2,
      description: t(
        'Регистратор домена и совпадения с реестром — разные сведения.',
        'Домен тіркеушісі мен тізілім сәйкестіктері — бөлек мәліметтер.',
      ),
      kinds: [
        'registrar',
        'registrant_organization',
        'registration',
        'expiration',
        'last changed',
        'registry_match',
      ],
    },
    {
      title: t('Технические сведения', 'Техникалық мәліметтер'),
      icon: Globe2,
      description: t(
        'IP-адреса, DNS и сертификат. Общая инфраструктура не означает общего владельца.',
        'IP мекенжайлары, DNS және сертификат. Ортақ инфрақұрылым ортақ иені білдірмейді.',
      ),
      kinds: [
        'dns_A',
        'dns_AAAA',
        'dns_CNAME',
        'dns_NS',
        'dns_MX',
        'dns_TXT',
        'tls_names',
        'tls_issuer',
        'tls_validity',
      ],
    },
  ];
  const label = (kind: string) =>
    osintLabels[kind]?.[lang] ||
    {
      dns_A: t('IP-адреса IPv4', 'IPv4 мекенжайлары'),
      dns_AAAA: t('IP-адреса IPv6', 'IPv6 мекенжайлары'),
      dns_NS: t('DNS-серверы', 'DNS серверлері'),
      dns_MX: t('Почтовые серверы', 'Пошта серверлері'),
      dns_CNAME: t('Псевдонимы домена', 'Домен бүркеншік аттары'),
      dns_TXT: t('Текстовые записи DNS', 'DNS мәтіндік жазбалары'),
    }[kind] ||
    kind;
  return (
    <section className="resource-workspace">
      <div className="workspace-heading">
        <div>
          <h2>{t('Сведения о ресурсе', 'Ресурс туралы мәліметтер')}</h2>
          <p>
            {r.hostname || t('Домен не установлен', 'Домен анықталмады')}
            {r.registrationDomain && r.registrationDomain !== r.hostname
              ? ' · ' + r.registrationDomain
              : ''}
          </p>
        </div>
        <span className="coverage-pill">
          {r.status === 'completed'
            ? t('Доступные данные собраны', 'Қолжетімді деректер жиналды')
            : t('Часть данных недоступна', 'Деректер ішінара қолжетімсіз')}
        </span>
      </div>
      {groups.map((group, i) => {
        const observations = clean.filter((o) => group.kinds.includes(o.kind));
        return (
          <details className="resource-group" key={i} open={i === 0}>
            <summary>
              <group.icon size={21} />
              <span>
                {group.title}
                <small>
                  {observations.length
                    ? t(`Записей: ${observations.length}`, `Жазбалар: ${observations.length}`)
                    : t('Нет данных', 'Деректер жоқ')}
                </small>
              </span>
              <span className="expand-label">{t('Подробнее', 'Толығырақ')}</span>
            </summary>
            <div className="resource-group-body">
              <p className="muted">{group.description}</p>
              {!observations.length && (
                <p>
                  {t(
                    'В полученных источниках данные не обнаружены.',
                    'Алынған дереккөздерден мәлімет табылмады.',
                  )}
                </p>
              )}
              {observations.map((o) => (
                <article key={o.key} className="observation-row">
                  <span>{label(o.kind)}</span>
                  <div>
                    {o.lines.map((line, i) => (
                      <strong className="clean-value" key={i}>
                        {maskPersonalIds(line)}
                      </strong>
                    ))}
                    {o.claimed && (
                      <small>
                        {t(
                          'Опубликовано в источнике · принадлежность не подтверждена',
                          'Дереккөзде жарияланған · тиесілілігі расталмаған',
                        )}
                      </small>
                    )}
                    <details>
                      <summary>
                        {t('Показать источник', 'Дереккөзді көрсету')}
                        {o.sources.length > 1 ? ` · ${o.sources.length}` : ''}
                      </summary>
                      {o.sources.map((source) => (
                        <div key={source.id} className="source-proof">
                          {source.quote && <blockquote>{maskPersonalIds(source.quote)}</blockquote>}
                          <p>
                            {source.sourceUrl ||
                              t(
                                'Предоставленный материал / технический ответ',
                                'Берілген материал / техникалық жауап',
                              )}
                          </p>
                          <a
                            className="text-button"
                            href={`/api/cases/${current.id}/evidence/${source.evidenceId}`}
                            download
                          >
                            <Download size={14} />
                            {t('Сохранённый источник', 'Сақталған дереккөз')}
                          </a>
                        </div>
                      ))}
                    </details>
                  </div>
                </article>
              ))}
            </div>
          </details>
        );
      })}
      <details className="resource-group">
        <summary>
          <Network size={21} />
          <span>
            {t('Связи с другими ресурсами', 'Басқа ресурстармен байланыстар')}
            <small>
              {r.relations?.length || 0} {t('технических связей', 'техникалық байланыс')}
            </small>
          </span>
          <span className="expand-label">{t('Подробнее', 'Толығырақ')}</span>
        </summary>
        <div className="resource-group-body">
          <p>
            {t(
              'Это технические наблюдения. Зеркалирование и общий владелец не подтверждены.',
              'Бұл — техникалық бақылаулар. Айна сайт пен ортақ ие расталмаған.',
            )}
          </p>
          {!r.relations?.length && (
            <p>
              {current.analysisLevel === 'pro'
                ? t(
                    'В доступных источниках связи не обнаружены.',
                    'Қолжетімді дереккөздерден байланыстар табылмады.',
                  )
                : t(
                    'Поиск связей выполняется в режиме Pro.',
                    'Байланыстарды іздеу Pro режимінде орындалады.',
                  )}
            </p>
          )}
          <ResourceGraph c={current} lang={lang} onChange={onChange} />
          {r.candidates?.map((candidate) => (
            <p key={candidate.hostname}>
              {candidate.hostname} ·{' '}
              {candidate.status === 'content_checked'
                ? t(
                    'Содержимое сохранено и передано на анализ',
                    'Мазмұны сақталып, талдауға жіберілді',
                  )
                : candidate.status === 'dns_checked'
                  ? t('DNS проверен; содержимое не изучено', 'DNS тексерілді; мазмұны зерттелмеді')
                  : candidate.status === 'unavailable'
                    ? t('Проверка недоступна', 'Тексеру қолжетімсіз')
                    : t('Не проверен: лимит обхода', 'Тексерілмеді: аралау шегі')}
            </p>
          ))}
        </div>
      </details>
      <details className="technical-details">
        <summary>
          {t('Полнота и ограничения источников', 'Дереккөздердің толықтығы мен шектеулері')}
        </summary>
        {r.stages.map((stage) => (
          <p key={stage.id}>{stage.summary[lang]}</p>
        ))}
      </details>
    </section>
  );
}
