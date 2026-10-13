import { ArrowUpRight, History } from 'lucide-react';
import type { AppController } from './useAppController.ts';
type Props = Pick<
  AppController,
  'lang' | 'setLang' | 't' | 'records' | 'setDrawer' | 'run' | 'refreshHistory' | 'reset'
>;
export function AppHeader({
  lang,
  setLang,
  t,
  records,
  setDrawer,
  run,
  refreshHistory,
  reset,
}: Props) {
  return (
    <header className="header">
      <a
        className="brand"
        href="#"
        onClick={(e) => {
          e.preventDefault();
          reset();
        }}
        aria-label="aigak"
      >
        <span className="brand-mark">
          <i />
          <i />
          <i />
        </span>
        aigak<span className="beta">BETA</span>
      </a>
      <nav>
        <button className="text-button help-link" onClick={() => setDrawer('help')}>
          {t('Как это работает', 'Қалай жұмыс істейді')}
          <ArrowUpRight size={15} />
        </button>
        <button
          className="text-button"
          onClick={() => {
            setDrawer('history');
            void run(refreshHistory);
          }}
        >
          <History size={17} />
          <span>{t('История', 'Тарих')}</span>
          {records.length > 0 && <span className="counter">{records.length}</span>}
        </button>
        <div className="languages" aria-label="Language">
          <button
            aria-pressed={lang === 'ru'}
            className={lang === 'ru' ? 'selected' : ''}
            onClick={() => setLang('ru')}
          >
            RU
          </button>
          <button
            aria-pressed={lang === 'kk'}
            className={lang === 'kk' ? 'selected' : ''}
            onClick={() => setLang('kk')}
          >
            ҚАЗ
          </button>
        </div>
      </nav>
    </header>
  );
}
