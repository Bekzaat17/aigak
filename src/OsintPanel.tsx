import type {CaseRecord,Lang} from '../shared/types';
import {maskPersonalIds,osintLabels} from '../shared/osint';
export function OsintPanel({current,lang}:{current:CaseRecord;lang:Lang}){
 const report=current.osint;if(!report)return null;
 const t=(ru:string,kk:string)=>lang==='ru'?ru:kk;
 return <section className="panel osint-panel">
  <h3>{t('Паспорт ресурса и публичные реквизиты','Ресурс паспорты және ашық деректемелер')}</h3>
  <p>{report.hostname||t('Домен не установлен','Домен анықталмады')} · {report.status==='completed'?t('Сбор завершён','Жинау аяқталды'):t('Данные получены частично','Деректер ішінара алынды')}</p>
  {report.registrationDomain&&<p>{t('Регистрируемый домен','Тіркелетін домен')}: {report.registrationDomain}</p>}
  {report.unicodeHostname!==report.hostname&&<p>{report.unicodeHostname}</p>}
  <p className="muted">{t('Публикация реквизитов и общая инфраструктура не подтверждают владельца. Значения сверяются с источниками.','Деректемелердің жариялануы мен ортақ инфрақұрылым иені растамайды. Мәндер дереккөздермен салыстырылады.')}</p>
  <details><summary>{t('Источники и полнота сбора','Дереккөздер және жинау толықтығы')}</summary>{report.stages.map(s=><p key={s.id}><strong>{s.id} · {s.status}</strong><br/>{s.summary[lang]}</p>)}</details>
  {report.observations.length===0&&<p>{t('Извлекаемые контакты и регистрационные сведения не найдены.','Алынатын байланыстар мен тіркеу мәліметтері табылмады.')}</p>}
  {!!report.legalNorms?.length&&<details><summary>{t('Сохранённые нормы закона','Сақталған заң нормалары')}</summary><p>{t('Редакция на дату события требует проверки инспектором.','Оқиға күніндегі редакцияны инспектор тексеруі қажет.')}</p>{report.legalNorms.map(n=><article key={n.id}><strong>{t('Статья','Бап')} {n.article}</strong><p>{n.sourceUrl} · {n.retrievedAt}</p><a href={`/api/cases/${current.id}/evidence/${n.evidenceId}`} download>{t('Официальный исходник','Ресми түпнұсқа')}</a><pre style={{whiteSpace:'pre-wrap'}}>{n.quote}</pre></article>)}</details>}
  {!!report.relations?.length&&<details open><summary>{t('Технические связи','Техникалық байланыстар')} · {report.relations.length}</summary>
   <p>{t('Ссылка или имя в сертификате — наблюдение, а не подтверждённое зеркало. DNS-проверка не подтверждает работоспособность сайта.','Сілтеме немесе сертификаттағы атау — бақылау, расталған айна сайт емес. DNS тексеруі сайттың жұмысын растамайды.')}</p>
   {report.relations.map(r=><p key={r.id} className="break-all">{r.from} → {r.to} · {r.kind} {r.evidenceIds.map(id=><a key={id} href={`/api/cases/${current.id}/evidence/${id}`} download>{t('Источник','Дереккөз')} </a>)}</p>)}
   {report.candidates?.map(c=><p key={c.hostname}>{c.hostname} · {c.status}</p>)}
  </details>}
  <div className="osint-observations">{report.observations.map(o=><article key={o.id}>
   <strong>{osintLabels[o.kind]?.[lang]||o.kind}</strong>
   <p className="break-all">{maskPersonalIds(o.value)}</p>
   {o.status==='claimed'&&<small>{t('Заявлено в источнике · требуется сверка','Дереккөзде көрсетілген · салыстыру қажет')}</small>}
   {o.quote&&<blockquote>{maskPersonalIds(o.quote)}</blockquote>}
   <small>{o.sourceUrl||t('Загруженный материал / технический ответ','Жүктелген материал / техникалық жауап')} · {o.collectedAt}</small>
   <a href={`/api/cases/${current.id}/evidence/${o.evidenceId}`} download>{t('Сохранённый источник','Сақталған дереккөз')}</a>
  </article>)}</div>
 </section>;
}
