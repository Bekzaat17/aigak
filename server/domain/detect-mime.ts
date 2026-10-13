export function detectMime(data: Buffer, name: string) {
  if (data.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])))
    return 'image/png';
  if (data[0] === 255 && data[1] === 216 && data[2] === 255) return 'image/jpeg';
  if (data.subarray(0, 4).toString() === 'RIFF' && data.subarray(8, 12).toString() === 'WEBP')
    return 'image/webp';
  if (data.subarray(0, 5).toString() === '%PDF-') return 'application/pdf';
  if (/\.(txt|md|csv|html?|json)$/i.test(name) && !data.subarray(0, 4096).includes(0))
    return /\.html?$/i.test(name) ? 'text/html' : 'text/plain';
  return 'application/octet-stream';
}
