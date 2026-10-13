import type { CaseRecord, Evidence, Lang } from '../../../shared/types';

export const href = (c: CaseRecord, e: Evidence) => `/api/cases/${c.id}/evidence/${e.id}`;

export const stamp = (v: string, lang: Lang) =>
  new Intl.DateTimeFormat(lang === 'ru' ? 'ru-KZ' : 'kk-KZ', {
    dateStyle: 'short',
    timeStyle: 'short',
    timeZone: 'Asia/Almaty',
  }).format(new Date(v));
