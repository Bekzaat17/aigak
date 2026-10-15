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
    return {
      id: 'KZ-Z070000219-article-' + article,
      article,
      quote,
      documentId: 'Z070000219_',
      title: { ru: 'Об игорном бизнесе', kk: 'Ойын бизнесі туралы' },
    };
  });
}
/** Registry evidence only. Legal texts are owned exclusively by LegalCorpusService. */
export class OfficialSourcesService {
  constructor(private readonly fetcher: typeof safeFetch = safeFetch) {}
  async enrich(report: OsintReport, save: SaveArtifact) {
    const started = Date.now();
    const ids: string[] = [];
    try {
      const response = await this.fetcher(
        REGISTRY_URL,
        6 * 1024 * 1024,
        3,
        AbortSignal.timeout(16000),
      );
      if (response.status !== 200) throw new Error('OFFICIAL_SOURCE_UNAVAILABLE');
      const raw = await save(
        {
          name: 'bookmakers-2026-05-05.xlsx',
          mime: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
          bytes: response.body,
          sourceUrl: response.url,
        },
        'official-registry@1.0.0',
      );
      ids.push(raw.id);
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
      report.stages.push({
        id: 'registry',
        version: '1.0.0',
        status: 'partial',
        durationMs: Date.now() - started,
        evidenceIds: ids,
        summary: {
          ru: `Реестр букмекеров на 05.05.2026: совпадений ${matches.length}. Это исторический снимок; отсутствие строки не означает отсутствие лицензии, БИН на сайте не доказывает принадлежность.`,
          kk: `05.05.2026 күнгі букмекерлер тізілімі: сәйкестіктер ${matches.length}. Бұл тарихи көшірме; жолдың болмауы лицензияның жоқтығын білдірмейді, сайттағы БСН тиесілілікті дәлелдемейді.`,
        },
      });
    } catch {
      report.stages.push({
        id: 'registry',
        version: '1.0.0',
        status: 'failed',
        durationMs: Date.now() - started,
        evidenceIds: ids,
        summary: {
          ru: 'Реестр лицензий недоступен или его формат изменился. Отсутствие лицензии не установлено.',
          kk: 'Лицензиялар тізілімі қолжетімсіз немесе пішімі өзгерді. Лицензияның жоқтығы анықталмады.',
        },
      });
    }
    report.status = 'partial';
  }
}
