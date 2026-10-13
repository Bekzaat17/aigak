import Docxtemplater from 'docxtemplater';
import PizZip from 'pizzip';
import type { DocumentRenderer } from '../contracts.ts';

export class DocxRenderer implements DocumentRenderer {
  render(template: Buffer, fields: Record<string, string>): Buffer {
    const doc = new Docxtemplater(new PizZip(template), {
      paragraphLoop: true,
      linebreaks: true,
      nullGetter: () => '',
    });
    doc.render(fields);
    return doc.getZip().generate({ type: 'nodebuffer', compression: 'DEFLATE' });
  }
}
