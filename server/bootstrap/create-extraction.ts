import path from 'node:path';
import { FileExtractionService } from '../collection/FileExtractionService.ts';
import { TesseractOcrEngine } from '../collection/TesseractOcrEngine.ts';
import type { CollectionStorage } from '../collection/contracts.ts';
import { ImageExtractor } from '../collection/extractors/ImageExtractor.ts';
import { PdfExtractor } from '../collection/extractors/PdfExtractor.ts';
import { TextExtractor } from '../collection/extractors/TextExtractor.ts';

export function createExtraction(store: CollectionStorage, dataDirectory: string) {
  const ocr = new TesseractOcrEngine(path.join(dataDirectory, 'ocr'));
  return new FileExtractionService(store, [
    new TextExtractor(),
    new PdfExtractor(ocr),
    new ImageExtractor(ocr),
  ]);
}
