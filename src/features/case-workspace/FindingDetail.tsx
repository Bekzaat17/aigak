import { ArrowRight, Check, FileText, Image } from 'lucide-react';
import { useState } from 'react';
import type { CaseRecord, Finding, Lang } from '../../../shared/types';
import { findingImage, linkedHypotheses } from '../../case-view';
import { RegionEditor } from '../../RegionEditor';
import { LegalSourceLink } from './LegalSourceLink';
import { SourcePreview } from './SourcePreview.tsx';

export function FindingDetail({
  c,
  f,
  lang,
  busy,
  save,
  onLaw,
  onChange,
}: {
  c: CaseRecord;
  f: Finding;
  lang: Lang;
  busy: boolean;
  save: (decision: Finding['decision'], note: string) => void;
  onLaw: () => void;
  onChange: (c: CaseRecord) => void;
}) {
  const t = (ru: string, kk: string) => (lang === 'ru' ? ru : kk);
  const [note, setNote] = useState(f.note || '');
  const source = c.evidence.find((e) => e.id === f.evidenceId);
  const image = findingImage(c, f);
  const hypotheses = linkedHypotheses(c, f);
  return (
    <article className="finding-detail">
      <span className="eyebrow">
        {t('НАХОДКА', 'БЕЛГІ')} {String(c.findings.indexOf(f) + 1).padStart(2, '0')}
      </span>
      <h2>{f.title[lang]}</h2>
      {f.scope === 'related' && (
        <p className="inline-error">
          {t(
            'Находка на другом ресурсе. Она не доказывает содержимое исходного сайта.',
            'Белгі басқа ресурста табылды. Ол бастапқы сайттың мазмұнын дәлелдемейді.',
          )}
          <br />
          {source?.sourceUrl}
        </p>
      )}
      <section>
        <h3>{t('Почему это важно', 'Неліктен маңызды')}</h3>
        <p>{f.explanation[lang]}</p>
      </section>
      <section>
        <h3>{t('Что найдено в материале', 'Материалда не табылды')}</h3>
        <blockquote className="finding-quote">«{f.quote}»</blockquote>
        {source?.sourceUrl && (
          <p>
            <a href={source.sourceUrl} target="_blank" rel="noreferrer">
              {source.sourceUrl}
            </a>
          </p>
        )}
        <p className="muted">
          {t('Точная цитата из сохранённого текста', 'Сақталған мәтіннен алынған нақты дәйексөз')}
        </p>
        {image && (
          <>
            <p className="preview-label">
              <Image size={16} />
              {image.capture
                ? t('Снимок участка с цитатой · текст перепроверен', 'Белгі мәтіні бар бет экраны')
                : image.method === 'playwright-screenshot'
                  ? t(
                      'Снимок той же страницы · без разметки цитаты',
                      'Сол беттің суреті · дәйексөз белгіленбеген',
                    )
                  : t('Изображение, из которого получен текст', 'Мәтін алынған кескін')}
            </p>
            <SourcePreview c={c} e={image} lang={lang} />
            <details>
              <summary>{t('Уточнить область на снимке', 'Сурет аймағын нақтылау')}</summary>
              <RegionEditor c={c} f={f} image={image} lang={lang} onChange={onChange} />
            </details>
          </>
        )}
        {source && (
          <details className="inline-source" open={!image}>
            <summary>
              <FileText size={16} />
              {t('Сохранённый текст страницы', 'Беттің сақталған мәтіні')}
            </summary>
            <SourcePreview c={c} e={source} lang={lang} />
          </details>
        )}
        {!image && source && (
          <p className="muted">
            {t(
              'Снимок с этой цитатой не зафиксирован; доступен сохранённый текст.',
              'Осы дәйексөз бар сурет тіркелмеген; сақталған мәтін қолжетімді.',
            )}
          </p>
        )}
        {!source && (
          <p>
            {t(
              'Источник недоступен. Не подтверждайте находку без сверки.',
              'Дереккөз қолжетімсіз. Салыстырмай белгіні растамаңыз.',
            )}
          </p>
        )}
      </section>
      {hypotheses.length > 0 && (
        <section className="linked-law">
          <h3>{t('Связь с законом', 'Заңмен байланыс')}</h3>
          {hypotheses.map((h, i) => (
            <p key={i}>
              <LegalSourceLink
                norm={c.osint?.legalNorms?.find((n) => n.id === h.normId)}
                lang={lang}
              />{' '}
              {h.reason[lang]}
            </p>
          ))}
          <button className="text-button" onClick={onLaw}>
            {t('Открыть норму и условия применения', 'Норма мен қолдану шарттарын ашу')}
            <ArrowRight size={15} />
          </button>
        </section>
      )}
      {f.rule && (
        <details className="rule-details">
          <summary>{t('Как получена находка', 'Белгі қалай алынды')}</summary>
          <p>
            {t('Автоматическое правило', 'Автоматты ереже')}: {f.rule.id} · {f.rule.version}
          </p>
          {f.rule.contexts.map((x, i) => (
            <p key={i}>
              {x.title[lang]}: {x.question[lang]}
            </p>
          ))}
        </details>
      )}
      <section className="decision-area">
        <h3>{t('Ваше решение по этой находке', 'Осы белгі бойынша шешіміңіз')}</h3>
        <p>
          {t(
            'Подтверждение относится к находке, а не к юридической квалификации.',
            'Растау құқықтық саралауға емес, белгіге қатысты.',
          )}
        </p>
        <div className="decision-options">
          {(['accepted', 'rejected', 'pending'] as const).map((decision, i) => (
            <button
              key={decision}
              className={f.decision === decision ? 'chosen' : ''}
              aria-pressed={f.decision === decision}
              disabled={busy}
              onClick={() => save(decision, note)}
            >
              {
                [
                  t('Подтвердить', 'Растау'),
                  t('Отклонить', 'Қабылдамау'),
                  t('Нужно уточнить', 'Нақтылау қажет'),
                ][i]
              }
              {f.decision === decision && <Check size={15} />}
            </button>
          ))}
        </div>
        <details>
          <summary>
            {t('Добавить пояснение', 'Түсіндірме қосу')}
            {f.note ? ' ✓' : ''}
          </summary>
          <textarea
            aria-label={t('Пояснение к находке', 'Белгіге түсіндірме')}
            value={note}
            onChange={(e) => setNote(e.target.value)}
            maxLength={2000}
            rows={3}
          />
          <button
            className="secondary small"
            disabled={busy}
            onClick={() => save(f.decision, note)}
          >
            {t('Сохранить', 'Сақтау')}
          </button>
        </details>
      </section>
    </article>
  );
}
