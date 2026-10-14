import type { ExtractionContext, FileExtractor } from '../contracts.ts';
import { htmlText } from '../html-text.ts';
import { saveText } from '../text-evidence.ts';
export class TextExtractor implements FileExtractor {
  supports(mime: string): boolean {
    return mime === 'text/plain' || mime === 'text/html';
  }
  async extract({ store, record: c, evidence: e, data }: ExtractionContext): Promise<void> {
    await saveText(
      store,
      c,
      e,
      e.mime === 'text/html' ? htmlText(data.toString('utf8')).text : data.toString('utf8'),
      e.mime === 'text/html' ? 'html-text' : 'utf8',
    );
  }
}
