import type { ExtractionContext, FileExtractor, OcrEngine } from '../contracts.ts';
import { issue, saveText } from '../text-evidence.ts';
export class ImageExtractor implements FileExtractor {
  constructor(private readonly ocr: OcrEngine) {}
  supports(mime: string): boolean {
    return mime.startsWith('image/');
  }
  async extract({ store, record: c, evidence: e, data }: ExtractionContext): Promise<void> {
    if (!this.ocr.available) {
      issue(
        c,
        'OCR не настроен: выполните npm run setup:ocr. Изображение сохранено.',
        'OCR бапталмаған: npm run setup:ocr орындаңыз. Кескін сақталды.',
      );
      return;
    }
    saveText(store, c, e, await this.ocr.recognize(data), 'tesseract-rus-kaz-eng');
    issue(
      c,
      'Текст изображения получен OCR: сверьте цитаты с оригиналом.',
      'Кескін мәтіні OCR арқылы алынды: дәйексөздерді түпнұсқаларды салыстырыңыз.',
    );
  }
}
