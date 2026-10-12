import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
const dir = path.resolve(process.env.DATA_DIR || 'data', 'ocr');
await mkdir(dir, { recursive: true });
for (const lang of ['rus', 'kaz', 'eng']) {
  const response = await fetch(`https://tessdata.projectnaptha.com/4.0.0_best/${lang}.traineddata.gz`);
  if (!response.ok) throw new Error(`OCR ${lang}: HTTP ${response.status}`);
  await writeFile(path.join(dir, `${lang}.traineddata.gz`), Buffer.from(await response.arrayBuffer()));
  console.log(`OCR installed: ${lang}`);
}
