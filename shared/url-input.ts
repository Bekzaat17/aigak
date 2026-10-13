/** Input convenience only; network access still passes the server's public-URL policy. */
export function normalizeUrlInput(input: string): string {
  let value = input.trim();
  const markdown = value.match(/^\[[\s\S]*?\]\(\s*(<?[^\s>]+>?)\s*\)$/);
  if (markdown) value = markdown[1];
  value = value.replace(/^[<«"']+|[>»"']+$/g, '').trim();
  if (/\s/.test(value)) {
    const urls = value.match(/https?:\/\/[^\s<>"'«»]+/gi);
    if (urls?.length === 1) value = urls[0].replace(/[),.;!?]+$/, '');
    else throw new Error('INVALID_SOURCE_URL');
  }
  if (value.startsWith('//')) value = 'https:' + value;
  else if (!/^https?:\/\//i.test(value)) {
    if (/^[a-z][a-z\d+.-]*:/i.test(value) && !/^([^/:]+\.)+[^/:]+:\d+(?:[/?#]|$)/u.test(value))
      throw new Error('INVALID_SOURCE_URL');
    value = 'https://' + value;
  }
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new Error('INVALID_SOURCE_URL');
  }
  if (
    !['http:', 'https:'].includes(url.protocol) ||
    url.username ||
    url.password ||
    (!url.hostname.includes('.') && !url.hostname.startsWith('['))
  )
    throw new Error('INVALID_SOURCE_URL');
  return url.href;
}
