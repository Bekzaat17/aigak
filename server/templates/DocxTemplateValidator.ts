import Docxtemplater from 'docxtemplater';
import PizZip from 'pizzip';
import type { TemplateValidator } from '../application/ports/templates.ts';
import { fields } from './fields.ts';

export class DocxTemplateValidator implements TemplateValidator {
  validate(data: Buffer) {
    if (data.length > 2 * 1024 * 1024) throw new Error('TEMPLATE_TOO_LARGE');
    try {
      const zip = new PizZip(data);
      const entries = Object.values(zip.files);
      let bytes = 0;
      if (entries.length > 200 || !zip.file('word/document.xml'))
        throw new Error('INVALID_TEMPLATE');
      for (const entry of entries) {
        if (entry.dir) continue;
        const size =
          (entry as unknown as { _data?: { uncompressedSize?: number } })._data?.uncompressedSize ||
          0;
        bytes += size;
        if (bytes > 15 * 1024 * 1024) throw new Error('TEMPLATE_TOO_LARGE');
        if (/vbaProject|embeddings\//i.test(entry.name)) throw new Error('INVALID_TEMPLATE');
        if (entry.name.endsWith('.rels') && /TargetMode\s*=\s*["']External/i.test(entry.asText()))
          throw new Error('TEMPLATE_EXTERNAL_LINK');
      }
      const doc = new Docxtemplater(zip, { paragraphLoop: true, linebreaks: true });
      const text = doc.getFullText();
      if (!['case_number', 'findings', 'evidence_list'].every((f) => text.includes(`{${f}}`)))
        throw new Error('TEMPLATE_FIELDS_MISSING');
      const tags = [...text.matchAll(/\{([^{}]+)\}/g)].map((m) => m[1]);
      if (tags.some((t) => !fields.includes(t))) throw new Error('TEMPLATE_UNKNOWN_FIELD');
    } catch (e) {
      if (e instanceof Error && /^TEMPLATE_|^INVALID_TEMPLATE$/.test(e.message)) throw e;
      throw new Error('INVALID_TEMPLATE', { cause: e });
    }
  }
}
