import { load } from 'cheerio';
import { randomUUID } from 'node:crypto';
import PizZip from 'pizzip';
import type { OsintReport } from '../../shared/osint.ts';
import { safeFetch } from '../network.ts';
import type { SaveArtifact } from './contracts.ts';
import { domainTarget } from './domain.ts';
export const REGISTRY_URL =
  'https://www.gov.kz/uploads/2026/5/5/c7cbed85dfeddff96fe7929e76977829_original.25333.xlsx';
export const LAW_URL = 'https://old.adilet.zan.kz/rus/docs/Z070000219_';
export interface RegistryRow {
  row: number;
  bin: string;
  organization: string;
  license: string;
  website: string;
}
/** Adapter for the published 05.05.2026 workbook. Schema drift fails explicitly. */
export function parseRegistry(bytes: Buffer): RegistryRow[] {
  const zip = new PizZip(bytes);
  let size = 0;
  for (const f of Object.values(zip.files)) {
    size +=
      (f as unknown as { _data?: { uncompressedSize?: number } })._data?.uncompressedSize || 0;
  }
  if (size > 10 * 1024 * 1024) throw new Error('REGISTRY_TOO_LARGE');
  const stringsXml = zip.file('xl/sharedStrings.xml')?.asText(),
    sheetXml = zip.file('xl/worksheets/sheet1.xml')?.asText();
  if (!stringsXml || !sheetXml) throw new Error('REGISTRY_FORMAT');
  const stringsDoc = load(stringsXml, { xmlMode: true });
  const strings = stringsDoc('si')
    .map((_, e) => stringsDoc(e).text())
    .get();
  const $ = load(sheetXml, { xmlMode: true });
  const rows = $('row')
    .map((_, e) => {
      const cells: Record<string, string> = {};
      $(e)
        .find('c')
        .each((_, c) => {
          const cell = $(c);
          const raw = cell.find('v').text();
          cells[(cell.attr('r') || '').replace(/\d/g, '')] =
            cell.attr('t') === 's' ? strings[Number(raw)] || '' : raw;
        });
      return { row: Number($(e).attr('r')), cells };
    })
    .get();
  if (!rows.some((r) => r.cells.E === 'БИН' && r.cells.J === 'Интернет сайт'))
    throw new Error('REGISTRY_SCHEMA_CHANGED');
  if (!strings.some((s) => s.includes('05.05.2026'))) throw new Error('REGISTRY_DATE_CHANGED');
  return rows
    .filter((r) => /^\d{12}$/.test((r.cells.E || '').replace(/\s/g, '')))
    .map((r) => ({
      row: r.row,
      bin: r.cells.E.replace(/\s/g, ''),
      organization: r.cells.D,
      license: r.cells.C,
      website: r.cells.J || '',
    }));
}
export function registryMatches(rows: RegistryRow[], report: OsintReport) {
  const bins = report.observations
    .filter((o) => o.kind === 'business_id')
    .map((o) => o.value.replace(/\D/g, ''));
  return rows.flatMap((row) => {
    let domain = false;
    try {
      domain =
        domainTarget(row.website).hostname.replace(/^www\./, '') ===
        report.hostname?.replace(/^www\./, '');
    } catch {
      /* Not a single valid URL. */
    }
    const bin = bins.includes(row.bin);
    return bin || domain
      ? [
          {
            ...row,
            matchedBy: [...(bin ? ['declared_bin'] : []), ...(domain ? ['exact_domain'] : [])],
          },
        ]
      : [];
  });
}
export function parseLaw(html: string) {
  const $ = load(html);
  $('script,style').remove();
  const text = $('body').text();
  if (!text.includes('Закон Республики Казахстан от 12 января 2007 года № 219'))
    throw new Error('LAW_IDENTITY_MISMATCH');
  return ['1', '6', '9'].map((article) => {
    const start = text.indexOf('Статья ' + article + '.');
    const end = text.indexOf('Статья ', start + 8);
    if (start < 0 || end < 0) throw new Error('LAW_FORMAT_CHANGED');
    const quote = text.slice(start, end).trim();
    if (quote.length > 20000 || quote.length < 50) throw new Error('LAW_FORMAT_CHANGED');
    return { id: 'KZ-Z070000219-article-' + article, article, quote };
  });
}
/** External sources are collected before reasoning; errors preserve the existing case. */
export class OfficialSourcesService {
  constructor(private readonly fetcher: typeof safeFetch = safeFetch) {}
  async enrich(report: OsintReport, save: SaveArtifact) {
    for (const kind of ['registry', 'law'] as const) {
      const started = Date.now();
      const ids: string[] = [];
      try {
        const url = kind === 'registry' ? REGISTRY_URL : LAW_URL;
        const response = await this.fetcher(url, 6 * 1024 * 1024, 3, AbortSignal.timeout(16000));
        if (response.status !== 200) throw new Error('OFFICIAL_SOURCE_UNAVAILABLE');
        const raw = save(
          {
            name: kind === 'registry' ? 'bookmakers-2026-05-05.xlsx' : 'law-Z070000219.html',
            mime:
              kind === 'registry'
                ? 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
                : 'text/html',
            bytes: response.body,
            sourceUrl: response.url,
          },
          'official-' + kind + '@1.0.0',
        );
        ids.push(raw.id);
        if (kind === 'registry') {
          const matches = registryMatches(parseRegistry(response.body), report);
          report.registry = { sourceDate: '2026-05-05', evidenceId: raw.id, matches };
          for (const match of matches)
            report.observations.push({
              id: randomUUID(),
              kind: 'registry_match',
              value: JSON.stringify(match),
              evidenceId: raw.id,
              sourceUrl: raw.sourceUrl,
              collectedAt: raw.createdAt,
              collector: 'official-registry@1.0.0',
              status: 'observed',
            });
        } else {
          report.legalNorms = parseLaw(response.body.toString()).map((n) => ({
            ...n,
            evidenceId: raw.id,
            sourceUrl: response.url,
            retrievedAt: raw.createdAt,
            temporalStatus: 'requires_review' as const,
          }));
        }
        report.stages.push({
          id: kind,
          version: '1.0.0',
          status: 'partial',
          durationMs: Date.now() - started,
          evidenceIds: ids,
          summary:
            kind === 'registry'
              ? {
                  ru: `Реестр букмекеров на 05.05.2026: совпадений ${report.registry!.matches.length}. Это исторический снимок; отсутствие строки не означает отсутствие лицензии, БИН на сайте не доказывает принадлежность.`,
                  kk: `05.05.2026 күнгі букмекерлер тізілімі: сәйкестіктер ${report.registry!.matches.length}. Бұл тарихи көшірме; жолдың болмауы лицензияның жоқтығын білдірмейді, сайттағы БСН тиесілілікті дәлелдемейді.`,
                }
              : {
                  ru: 'Сохранены статьи 1, 6, 9 закона РК «Об игорном бизнесе». Применимость редакции на дату события требует проверки инспектором; корпус не охватывает всё законодательство.',
                  kk: '«Ойын бизнесі туралы» ҚР заңының 1, 6, 9-баптары сақталды. Оқиға күніндегі редакцияның қолданылуын инспектор тексеруі тиіс; корпус барлық заңнаманы қамтымайды.',
                },
        });
      } catch {
        report.stages.push({
          id: kind,
          version: '1.0.0',
          status: 'failed',
          durationMs: Date.now() - started,
          evidenceIds: ids,
          summary: {
            ru: 'Официальный источник недоступен или его формат изменился. Заключение не сформировано.',
            kk: 'Ресми дереккөз қолжетімсіз немесе пішімі өзгерді. Қорытынды жасалмады.',
          },
        });
      }
    }
    report.status = 'partial';
  }
}
