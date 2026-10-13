import { ChevronRight, Search } from 'lucide-react';
import { useState } from 'react';
import type { CaseRecord, Finding, Lang } from '../../../shared/types';
import { FindingDetail } from './FindingDetail.tsx';

export function FindingsWorkspace({
  c,
  lang,
  busy,
  save,
  onLaw,
  onPackage,
  onChange,
}: {
  c: CaseRecord;
  lang: Lang;
  busy: boolean;
  save: (f: Finding, decision: Finding['decision'], note: string) => void;
  onLaw: () => void;
  onPackage: () => void;
  onChange: (c: CaseRecord) => void;
}) {
  const t = (ru: string, kk: string) => (lang === 'ru' ? ru : kk);
  const [selected, setSelected] = useState(
    c.findings.find((f) => f.decision === 'pending')?.id || c.findings[0]?.id || '',
  );
  const [filter, setFilter] = useState('all');
  const shown = c.findings.filter((f) => filter === 'all' || f.decision === filter);
  const f = shown.find((f) => f.id === selected) || shown[0];
  return (
    <section id="findings-workspace" className="findings-workspace">
      <div className="workspace-heading">
        <div>
          <h2>{t('Находки и их основания', 'Белгілер және олардың негіздері')}</h2>
          <p>
            {t(
              'Выберите находку. Справа — объяснение и сохранённый источник.',
              'Белгіні таңдаңыз. Оң жақта — түсіндірме және сақталған дереккөз.',
            )}
          </p>
        </div>
        <label>
          {t('Показать', 'Көрсету')}
          <select value={filter} onChange={(e) => setFilter(e.target.value)}>
            <option value="all">{t('Все находки', 'Барлық белгілер')}</option>
            <option value="pending">{t('Нужно проверить', 'Тексеру қажет')}</option>
            <option value="accepted">{t('Подтверждённые', 'Расталған')}</option>
            <option value="rejected">{t('Отклонённые', 'Қабылданбаған')}</option>
          </select>
        </label>
      </div>
      {!shown.length ? (
        <div className="empty-result">
          <Search size={30} />
          <h3>
            {c.findings.length
              ? t('В этой группе находок нет', 'Бұл топта белгілер жоқ')
              : t('Нет находок для подтверждения', 'Растайтын белгілер жоқ')}
          </h3>
          <p>
            {t(
              'Откройте сохранённые материалы, чтобы проверить полноту анализа.',
              'Талдаудың толықтығын тексеру үшін сақталған материалдарды ашыңыз.',
            )}
          </p>
          <button className="secondary" onClick={onPackage}>
            {t('Перейти к проверке', 'Тексеруге өту')}
          </button>
        </div>
      ) : (
        <div className="finding-split">
          <nav className="finding-index" aria-label={t('Находки', 'Белгілер')}>
            {shown.map((item) => (
              <button
                key={item.id}
                aria-current={item.id === f?.id ? 'true' : undefined}
                className={item.id === f?.id ? 'selected' : ''}
                onClick={() => setSelected(item.id)}
              >
                <span className="index-number">
                  {String(c.findings.indexOf(item) + 1).padStart(2, '0')}
                </span>
                <span>
                  <strong>{item.title[lang]}</strong>
                  <small>
                    {item.decision === 'accepted'
                      ? t('Подтверждено вами', 'Сіз растадыңыз')
                      : item.decision === 'rejected'
                        ? t('Отклонено вами', 'Сіз қабылдамадыңыз')
                        : t('Нужно проверить', 'Тексеру қажет')}
                  </small>
                </span>
                <ChevronRight size={16} />
              </button>
            ))}
          </nav>
          {f && (
            <FindingDetail
              key={f.id}
              c={c}
              f={f}
              lang={lang}
              busy={busy}
              save={(decision, note) => save(f, decision, note)}
              onLaw={onLaw}
              onChange={onChange}
            />
          )}
        </div>
      )}
    </section>
  );
}
