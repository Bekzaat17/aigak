import type { ExtractionContext, FileExtractor, OcrEngine } from '../contracts.ts';
import { issue, saveText } from '../text-evidence.ts';
export class PdfExtractor implements FileExtractor {
  constructor(private readonly ocr: OcrEngine) {}
  supports(mime: string): boolean {
    return mime === 'application/pdf';
  }
  async extract({ store, record: c, evidence: e, data }: ExtractionContext): Promise<void> {
    const { getDocument } = await import('pdfjs-dist/legacy/build/pdf.mjs');
    const task = getDocument({ data: new Uint8Array(data), useSystemFonts: true });
    const doc = await task.promise;
    try {
      const pages: string[] = [];
      let scanned = 0;
      for (let n = 1; n <= Math.min(doc.numPages, 40); n++) {
        const page = await doc.getPage(n);
        const content = await page.getTextContent();
        const text = content.items.map((x) => ('str' in x ? x.str : '')).join(' ');
        if (text.trim().length >= 10) {
          pages.push(`[${n}]\n${text}`);
          continue;
        }
        if (++scanned > 10) continue;
        const size = page.getViewport({ scale: 1 });
        const viewport = page.getViewport({
          scale: Math.min(2, 1800 / Math.max(size.width, size.height)),
        });
        const factory = doc.canvasFactory as {
          create: (
            w: number,
            h: number,
          ) => {
            canvas: HTMLCanvasElement & { toBuffer: (type: string) => Buffer };
            context: CanvasRenderingContext2D;
          };
          destroy: (target: unknown) => void;
        };
        const target = factory.create(Math.ceil(viewport.width), Math.ceil(viewport.height));
        try {
          await page.render({ canvas: target.canvas, canvasContext: target.context, viewport })
            .promise;
          const png = target.canvas.toBuffer('image/png');
          const snapshot = store.addEvidence(c, png, {
            name: `${e.name}-page-${n}.png`,
            mime: 'image/png',
            kind: 'snapshot',
            method: 'pdfjs-render',
            parentId: e.id,
          });
          saveText(store, c, snapshot, await this.ocr.recognize(png), 'tesseract-pdf-page');
        } finally {
          factory.destroy(target);
        }
      }
      if (doc.numPages > 40)
        issue(c, 'PDF: обработаны первые 40 страниц.', 'PDF: алғашқы 40 бет өңделді.');
      if (scanned > 0)
        issue(
          c,
          'PDF содержит сканы: текст получен OCR, проверьте по изображениям страниц.',
          'PDF сканерленген беттерді қамтиды: мәтін OCR арқылы алынды, бет кескіндерімен салыстырыңыз.',
        );
      if (scanned > 10)
        issue(
          c,
          'OCR ограничен первыми 10 сканированными страницами PDF.',
          'OCR PDF құжатының алғашқы 10 сканерленген бетімен шектелген.',
        );
      const text = pages.join('\n\n');
      if (text.replace(/\[\d+\]/g, '').trim().length >= 10)
        saveText(store, c, e, text, 'pdfjs-text');
    } finally {
      await task.destroy();
    }
  }
}
