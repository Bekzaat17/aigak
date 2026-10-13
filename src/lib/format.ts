import type { Lang } from '../../shared/types';

export const date = (v: string, lang: Lang) =>
  new Intl.DateTimeFormat(lang === 'ru' ? 'ru-KZ' : 'kk-KZ', {
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'Asia/Almaty',
  }).format(new Date(v));

export const size = (bytes: number) =>
  bytes < 1024
    ? `${bytes} B`
    : `${(bytes / 1024 / (bytes >= 1048576 ? 1024 : 1)).toFixed(1)} ${bytes >= 1048576 ? 'MB' : 'KB'}`;
