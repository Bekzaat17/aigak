import type { PackageDocument } from './contracts.ts';
export function appendixNumber(c: PackageDocument, id: string) {
  return c.evidence.findIndex((e) => e.id === id) + 1;
}
/** Images are embedded from verified preserved bytes, never fetched by the renderer. */
export function previewImages(c: PackageDocument, read: (id: string) => Buffer) {
  const images: Record<string, string> = {};
  let remaining = 24 * 1024 * 1024;
  for (const e of c.evidence.filter((e) => e.mime.startsWith('image/'))) {
    if (e.size > remaining) continue;
    const bytes = read(e.id);
    remaining -= bytes.length;
    images[e.id] = `data:${e.mime};base64,${bytes.toString('base64')}`;
  }
  return images;
}
