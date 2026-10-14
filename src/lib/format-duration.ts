import type { Lang } from '../../shared/types';

export function formatDuration(durationMs: number | undefined, lang: Lang): string {
  if (durationMs === undefined || !Number.isFinite(durationMs) || durationMs < 0)
    return lang === 'ru' ? 'нет данных' : 'дерек жоқ';
  const seconds = durationMs / 1000;
  if (seconds < 60)
    return `${seconds.toLocaleString(lang === 'ru' ? 'ru-RU' : 'kk-KZ', { maximumFractionDigits: 1 })} с`;
  return `${Math.floor(seconds / 60)} мин ${Math.floor(seconds % 60)} с`;
}
