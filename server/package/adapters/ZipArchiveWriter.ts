import JSZip from 'jszip';
import type { ArchiveWriter, PackageFile } from '../contracts.ts';

export class ZipArchiveWriter implements ArchiveWriter {
  async build(files: PackageFile[]): Promise<Buffer> {
    const zip = new JSZip();
    for (const file of files) zip.file(file.path, file.bytes);
    return zip.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE' });
  }
}
