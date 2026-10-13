import JSZip from 'jszip';
import Docxtemplater from 'docxtemplater';
import PizZip from 'pizzip';
import { chromium, type LaunchOptions } from 'playwright';
import type { ArchiveWriter, DocumentRenderer, PdfRenderer, PackageFile, ReportLayout } from './contracts.ts';
import { reportHtml } from './html.ts';
import { templateFields } from './fields.ts';

export class StandardReportLayout implements ReportLayout {
  readonly id='standard';
  html=reportHtml;
  fields=templateFields;
}
export class DocxRenderer implements DocumentRenderer {
  render(template:Buffer,fields:Record<string,string>):Buffer {
    const doc=new Docxtemplater(new PizZip(template),{paragraphLoop:true,linebreaks:true,nullGetter:()=>''});
    doc.render(fields);
    return doc.getZip().generate({type:'nodebuffer',compression:'DEFLATE'});
  }
}
export class PlaywrightPdfRenderer implements PdfRenderer {
  constructor(private readonly options:LaunchOptions){}
  async render(reports:Parameters<PdfRenderer['render']>[0]):Promise<PackageFile[]> {
    const browser=await chromium.launch(this.options);
    try {
      const page=await browser.newPage({javaScriptEnabled:false});
      await page.route('**/*',r=>r.abort());
      const files:PackageFile[]=[];
      for(const report of reports){
        await page.setContent(report.html);
        files.push({path:`report-${report.lang}.pdf`,bytes:await page.pdf({format:'A4',printBackground:true})});
      }
      return files;
    } finally {await browser.close();}
  }
}
export class ZipArchiveWriter implements ArchiveWriter {
  async build(files:PackageFile[]):Promise<Buffer> {
    const zip=new JSZip();
    for(const file of files)zip.file(file.path,file.bytes);
    return zip.generateAsync({type:'nodebuffer',compression:'DEFLATE'});
  }
}
