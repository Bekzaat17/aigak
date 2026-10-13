import type { OsintObservation } from './osint.ts';
import type { Lang } from './types.ts';
export interface DisplayObservation {
  key: string;
  kind: string;
  lines: string[];
  sources: OsintObservation[];
  claimed: boolean;
}
const unique = (values: string[]) => [...new Set(values.map((v) => v.trim()).filter(Boolean))];
export function observationLines(o: OsintObservation, lang: Lang): string[] {
  const t = (ru: string, kk: string) => (lang === 'ru' ? ru : kk);
  const value = o.value.trim();
  const unavailable = [
    t('Не удалось прочитать запись источника', 'Дереккөз жазбасын оқу мүмкін болмады'),
  ];
  try {
    if (o.kind.startsWith('dns_')) {
      const data: unknown = JSON.parse(value);
      if (!Array.isArray(data)) return unavailable;
      if (o.kind === 'dns_MX')
        return unique(
          data.flatMap((v) =>
            v && typeof v === 'object' && 'exchange' in v && typeof v.exchange === 'string'
              ? [
                  v.exchange
                    ? `${v.exchange}${'priority' in v && typeof v.priority === 'number' ? t(' · приоритет ', ' · басымдық ') + v.priority : ''}`
                    : t('Домен не принимает почту (Null MX)', 'Домен пошта қабылдамайды (Null MX)'),
                ]
              : [],
          ),
        );
      if (o.kind === 'dns_TXT')
        return unique(
          data.flatMap((v) =>
            Array.isArray(v) && v.every((s) => typeof s === 'string')
              ? [v.join('')]
              : typeof v === 'string'
                ? [v]
                : [],
          ),
        );
      return unique(data.filter((v): v is string => typeof v === 'string'));
    }
    if (o.kind === 'tls_issuer') {
      const data = JSON.parse(value);
      if (!data || typeof data !== 'object' || Array.isArray(data)) return unavailable;
      return unique([data.O, data.CN, data.C].filter((v): v is string => typeof v === 'string'));
    }
    if (o.kind === 'registry_match') {
      const d = JSON.parse(value);
      if (!d || typeof d !== 'object' || typeof d.organization !== 'string') return unavailable;
      return [
        d.organization,
        ...(typeof d.bin === 'string' ? [t('БИН: ', 'БСН: ') + d.bin] : []),
        ...(typeof d.license === 'string' ? [t('Лицензия № ', 'Лицензия № ') + d.license] : []),
        ...(typeof d.website === 'string' && d.website ? [d.website] : []),
        t(
          'Снимок реестра на 05.05.2026; текущий статус не проверен',
          '05.05.2026 күнгі тізілім көшірмесі; қазіргі мәртебе тексерілмеген',
        ),
      ];
    }
    if (o.kind === 'tls_validity') {
      const dates = value.split(' — ').map((v) => new Date(v));
      if (dates.length !== 2 || dates.some((d) => Number.isNaN(d.getTime()))) return unavailable;
      return [
        dates
          .map((d) =>
            new Intl.DateTimeFormat(lang === 'ru' ? 'ru-KZ' : 'kk-KZ', {
              dateStyle: 'long',
              timeZone: 'UTC',
            }).format(d),
          )
          .join(' — '),
      ];
    }
    if (o.kind === 'tls_names')
      return unique(value.split(',').map((v) => v.trim().replace(/^DNS:/i, '')));
    if (['registration', 'expiration', 'last changed'].includes(o.kind)) {
      const date = new Date(value);
      return Number.isNaN(date.getTime())
        ? unavailable
        : [
            new Intl.DateTimeFormat(lang === 'ru' ? 'ru-KZ' : 'kk-KZ', {
              dateStyle: 'long',
              timeZone: 'UTC',
            }).format(date),
          ];
    }
    if (o.kind === 'phone') {
      const digits = value.replace(/\D/g, '');
      if (digits.length === 11 && ['7', '8'].includes(digits[0]))
        return [
          `+7 (${digits.slice(1, 4)}) ${digits.slice(4, 7)}-${digits.slice(7, 9)}-${digits.slice(9)}`,
        ];
    }
    if (o.kind === 'email') return [value.toLowerCase()];
    return [value];
  } catch {
    return unavailable;
  }
}
/** Merge display duplicates while retaining every evidence reference for inspection/export. */
export function displayObservations(
  observations: OsintObservation[],
  lang: Lang,
): DisplayObservation[] {
  const map = new Map<string, DisplayObservation>();
  for (const observation of observations) {
    const lines = observationLines(observation, lang);
    if (!lines.length) continue;
    const key =
      observation.kind +
      '|' +
      [...lines]
        .map((s) => s.toLowerCase().replace(/\s+/g, ' '))
        .sort()
        .join('|');
    const group = map.get(key);
    if (group) {
      if (
        !group.sources.some(
          (s) => s.evidenceId === observation.evidenceId && s.sourceUrl === observation.sourceUrl,
        )
      )
        group.sources.push(observation);
    } else
      map.set(key, {
        key,
        kind: observation.kind,
        lines,
        sources: [observation],
        claimed: observation.status === 'claimed',
      });
  }
  return [...map.values()];
}
