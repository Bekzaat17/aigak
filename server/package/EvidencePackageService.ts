import { sha256 as hash } from '../domain/sha256.ts';
import { validatePackageEvidence } from './validate-package-evidence.ts';
import { previewImages } from './appendices.ts';
import type {
  ArchiveWriter,
  DocumentRenderer,
  PackageFile,
  PackageInput,
  PackageResult,
  PdfRenderer,
  ReportLayout,
} from './contracts.ts';
import { verifyScript } from './verify-script.ts';

/** Application service: validate → structure → format → assemble. Never runs analysis or updates a case. */
export class EvidencePackageService {
  private readonly layouts: Map<string, ReportLayout>;
  constructor(
    layouts: ReportLayout[],
    private readonly documents: DocumentRenderer,
    private readonly pdf: PdfRenderer,
    private readonly archive: ArchiveWriter,
  ) {
    this.layouts = new Map(layouts.map((layout) => [layout.id, layout]));
    if (this.layouts.size !== layouts.length) throw new Error('DUPLICATE_LAYOUT');
  }
  async build(input: PackageInput): Promise<PackageResult> {
    const layout = this.layouts.get(input.layoutId || 'standard');
    if (!layout) throw new Error('UNKNOWN_LAYOUT');
    // Own the snapshot before any await; subsequent inspector edits cannot alter this package.
    const c = structuredClone(input.document);
    if (c.schemaVersion !== 'aigak-package-input/1') throw new Error('INVALID_PACKAGE_VERSION');
    const templates = { ru: Buffer.from(input.templates.ru), kk: Buffer.from(input.templates.kk) };
    const evidence = new Map(input.evidenceFiles.map((file) => [file.id, Buffer.from(file.bytes)]));
    validatePackageEvidence(c, evidence, input.evidenceFiles.length);
    // Structure both formats consistently; rejected observations remain visible.
    const order = { accepted: 0, pending: 1, rejected: 2 };
    c.findings.sort((a, b) => order[a.decision] - order[b.decision]);
    const files: PackageFile[] = [];
    const paths = new Set<string>();
    const add = (path: string, content: Buffer | string) => {
      if (
        !/^[a-zA-Z0-9][a-zA-Z0-9._/-]*$/.test(path) ||
        path.split('/').some((p) => p === '..' || p === '.' || !p) ||
        paths.has(path)
      )
        throw new Error('INVALID_PACKAGE_PATH');
      paths.add(path);
      files.push({ path, bytes: Buffer.isBuffer(content) ? content : Buffer.from(content) });
    };
    for (const e of c.evidence) add('evidence/' + e.storedName, evidence.get(e.id)!);
    add('case.json', JSON.stringify(c, null, 2));
    add('audit.json', JSON.stringify(c.audit, null, 2));
    if (c.revisions?.length) add('revisions.json', JSON.stringify(c.revisions, null, 2));
    if (c.osint) add('osint.json', JSON.stringify(c.osint, null, 2));
    if (c.inspection) add('inspection.json', JSON.stringify(c.inspection, null, 2));
    c.previewImages = previewImages(c, (id) => evidence.get(id)!);
    add(
      'appendices.json',
      JSON.stringify(
        c.evidence.map((e, i) => ({
          number: i + 1,
          evidenceId: e.id,
          path: 'evidence/' + e.storedName,
          sha256: e.sha256,
        })),
        null,
        2,
      ),
    );
    const reports = [];
    for (const lang of ['ru', 'kk'] as const) {
      const html = layout.html(c, lang);
      reports.push({ lang, html });
      add(`report-${lang}.html`, html);
      add(`document-${lang}.docx`, this.documents.render(templates[lang], layout.fields(c, lang)));
      add(`template-source-${lang}.docx`, templates[lang]);
    }
    add('template-source.docx', templates.ru); // Backward-compatible RU alias.
    const warnings: string[] = [];
    if (input.includePdf !== false) {
      let pdfFiles: PackageFile[] = [];
      try {
        pdfFiles = await this.pdf.render(reports);
        if (
          pdfFiles.length !== 2 ||
          !['report-ru.pdf', 'report-kk.pdf'].every((path) =>
            pdfFiles.some((f) => f.path === path && f.bytes.length > 0),
          )
        )
          throw new Error('INCOMPLETE_PDF');
      } catch {
        pdfFiles = [];
        warnings.push('PDF generation unavailable. Print report-ru.html / report-kk.html to PDF.');
      }
      for (const file of pdfFiles) add(file.path, file.bytes);
    }
    add(
      'README.txt',
      'aigak — проект пакета / пакет жобасы\n\ncase.json: versioned snapshot of evidence, findings and inspector decisions.\ninspection.json: inspection stages, when available.\naudit.json: local audit chain, not externally notarized.\nevidence/: original and derived files.\ntemplate-source-ru/kk.docx: exact templates used.\nmanifest.json: hashes of every file except itself.\nverify.mjs: run node verify.mjs after unpacking.\nThis is a draft, not an official blocking order.\n' +
        warnings.join('\n'),
    );
    add('verify.mjs', verifyScript);
    const manifest = files.map((f) => ({
      path: f.path,
      sha256: hash(f.bytes),
      size: f.bytes.length,
    }));
    add(
      'manifest.json',
      JSON.stringify(
        {
          format: 'aigak-evidence/2',
          caseId: c.id,
          createdAt: new Date().toISOString(),
          status: 'draft',
          officerReviewed: c.status === 'verified',
          demo: c.demo,
          layoutId: layout.id,
          exportWarnings: warnings,
          files: manifest,
        },
        null,
        2,
      ),
    );
    return { bytes: await this.archive.build(files), warnings, files: manifest };
  }
}
