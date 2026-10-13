import ipaddr from 'ipaddr.js';
export function publicAddress(address: string): boolean {
  try {
    const a = ipaddr.process(address);
    return a.range() === 'unicast';
  } catch {
    return false;
  }
}
export function parsePublicUrl(value: string) {
  const u = new URL(value);
  if (
    !['https:', 'http:'].includes(u.protocol) ||
    u.username ||
    u.password ||
    (u.port && !['80', '443'].includes(u.port))
  )
    throw new Error('UNSAFE_URL');
  const host = u.hostname.replace(/^\[|\]$/g, '').toLowerCase();
  if (
    !host ||
    host === 'localhost' ||
    host.endsWith('.localhost') ||
    host.endsWith('.local') ||
    host.endsWith('.internal') ||
    host.endsWith('.test')
  )
    throw new Error('UNSAFE_URL');
  if (ipaddr.isValid(host) && !publicAddress(host)) throw new Error('UNSAFE_URL');
  return u;
}
