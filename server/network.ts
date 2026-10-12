import dns from 'node:dns/promises';
import http from 'node:http';
import https from 'node:https';
import ipaddr from 'ipaddr.js';

export function publicAddress(address: string): boolean {
  try { const a = ipaddr.process(address); return a.range() === 'unicast'; } catch { return false; }
}
export function parsePublicUrl(value: string) {
  const u = new URL(value);
  if (!['https:', 'http:'].includes(u.protocol) || u.username || u.password || (u.port && !['80','443'].includes(u.port))) throw new Error('UNSAFE_URL');
  const host = u.hostname.replace(/^\[|\]$/g, '').toLowerCase();
  if (!host || host === 'localhost' || host.endsWith('.localhost') || host.endsWith('.local') || host.endsWith('.internal') || host.endsWith('.test')) throw new Error('UNSAFE_URL');
  if (ipaddr.isValid(host) && !publicAddress(host)) throw new Error('UNSAFE_URL');
  return u;
}
export async function resolvePublic(u: URL) {
  const addresses = await dns.lookup(u.hostname.replace(/^\[|\]$/g, ''), { all: true });
  if (!addresses.length || addresses.some(a => !publicAddress(a.address))) throw new Error('UNSAFE_URL');
  return addresses[0];
}
export interface CaptureResponse { body: Buffer; status: number; headers: http.IncomingHttpHeaders; url: string; redirects: {url:string;status:number}[] }
export async function safeFetch(value: string, maxBytes = 8 * 1024 * 1024, hops = 5): Promise<CaptureResponse> {
  let current = value; const redirects: CaptureResponse['redirects'] = [];
  for (let i = 0; i <= hops; i++) {
    const u = parsePublicUrl(current); const address = await resolvePublic(u);
    // Pin the checked DNS answer into the actual connection to prevent DNS rebinding.
    const result = await new Promise<{body:Buffer;status:number;headers:http.IncomingHttpHeaders}>((resolve, reject) => {
      const req = (u.protocol === 'https:' ? https : http).request(u, {
        method: 'GET', agent: false,
        headers: { 'User-Agent': 'aigak/0.1 (public evidence collection)', 'Accept-Encoding': 'identity', Accept: '*/*' },
        lookup: ((_host: string, opts: {all?:boolean}, callback: Function) => opts.all ? callback(null, [address]) : callback(null, address.address, address.family)) as never,
      }, res => {
        const chunks: Buffer[] = []; let size = 0;
        res.on('data', (chunk: Buffer) => { size += chunk.length; if (size > maxBytes) req.destroy(new Error('RESPONSE_TOO_LARGE')); else chunks.push(chunk); });
        res.on('end', () => resolve({body:Buffer.concat(chunks),status:res.statusCode || 0,headers:res.headers}));
        res.on('error', reject);
      });
      const timer = setTimeout(() => req.destroy(new Error('FETCH_TIMEOUT')), 12000);
      req.on('close', () => clearTimeout(timer)); req.on('error', reject); req.end();
    });
    redirects.push({url:u.href,status:result.status});
    if ([301,302,303,307,308].includes(result.status) && result.headers.location) { current = new URL(result.headers.location,u).href; continue; }
    if (result.headers['content-encoding'] && result.headers['content-encoding'] !== 'identity') throw new Error('UNSUPPORTED_ENCODING');
    return {...result,url:u.href,redirects};
  }
  throw new Error('TOO_MANY_REDIRECTS');
}
