import { existsSync } from 'node:fs';
import path from 'node:path';
import { createWorker } from 'tesseract.js';
import type { OcrEngine } from './contracts.ts';

export class TesseractOcrEngine implements OcrEngine {
  constructor(private readonly langPath: string) {}

  get available(): boolean {
    return ['rus', 'kaz', 'eng'].every((lang) =>
      existsSync(path.join(this.langPath, `${lang}.traineddata.gz`)),
    );
  }

  async recognize(data: Buffer): Promise<string> {
    if (!this.available) throw new Error('OCR_NOT_CONFIGURED');
    const worker = await createWorker(['rus', 'kaz', 'eng'], 1, {
      langPath: this.langPath,
      cacheMethod: 'none',
    });
    let timer: ReturnType<typeof setTimeout> | undefined;
    try {
      const result = await Promise.race([
        worker.recognize(data),
        new Promise<never>((_, reject) => {
          timer = setTimeout(() => reject(new Error('OCR_TIMEOUT')), 60000);
        }),
      ]);
      return result.data.text;
    } finally {
      clearTimeout(timer);
      await worker.terminate();
    }
  }
}
