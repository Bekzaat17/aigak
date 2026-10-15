import { safeFetch } from '../network';
import type { LegalSource } from './legal-catalog';
import type { LegalSourceReader } from './legal-source-reader';

export class AdiletHtmlReader implements LegalSourceReader {
  readonly id = 'adilet-html';
  constructor(private readonly get = safeFetch) {}
  async read(source: LegalSource, signal: AbortSignal) {
    const response = await this.get(source.url, 12 * 1024 * 1024, 3, signal);
    if (response.status !== 200) throw Error('LAW_UNAVAILABLE');
    return {
      html: response.body.toString(),
      artifact: {
        name: source.id + '.html',
        mime: 'text/html',
        bytes: response.body,
        sourceUrl: response.url,
      },
    };
  }
}
