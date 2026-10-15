import http from 'node:http';
import net from 'node:net';
import type { Duplex } from 'node:stream';
import { parsePublicUrl, resolvePublic } from '../../network.ts';

/** Chromium keeps its TLS stack; the proxy pins public DNS at the actual TCP connection. */
export class PublicEgressProxy {
  private readonly sockets = new Set<Duplex>();
  private bytes = 0;
  private connections = 0;
  private readonly server = http.createServer((_req, res) => res.writeHead(405).end());
  constructor(
    private readonly resolve = resolvePublic,
    private readonly maxBytes = 100 * 1024 * 1024,
  ) {
    this.server.on('connect', (req, client, head) => {
      this.sockets.add(client);
      client.on('error', () => {});
      client.on('close', () => this.sockets.delete(client));
      void this.tunnel(req.url || '', client, head).catch(() => client.destroy());
    });
  }
  private async tunnel(authority: string, client: Duplex, head: Buffer) {
    if (++this.connections > 300 || this.bytes >= this.maxBytes)
      throw Error('NETWORK_BUDGET_EXCEEDED');
    const url = parsePublicUrl('https://' + authority);
    if (url.pathname !== '/' || url.search || url.hash) throw Error('UNSAFE_URL');
    const address = await this.resolve(url);
    if (client.destroyed) return;
    const upstream = net.connect({
      host: address.address,
      family: address.family,
      port: Number(url.port || 443),
    });
    this.sockets.add(upstream);
    upstream.setTimeout(45000, () => upstream.destroy());
    upstream.on('error', () => client.destroy());
    client.on('error', () => upstream.destroy());
    client.on('close', () => upstream.destroy());
    upstream.on('close', () => {
      this.sockets.delete(upstream);
      client.destroy();
    });
    upstream.on('data', (data: Buffer) => {
      this.bytes += data.length;
      if (this.bytes > this.maxBytes) for (const socket of this.sockets) socket.destroy();
    });
    upstream.once('connect', () => {
      client.write('HTTP/1.1 200 Connection Established\r\n\r\n');
      if (head.length) upstream.write(head);
      client.pipe(upstream);
      upstream.pipe(client);
    });
  }
  async start() {
    await new Promise<void>((resolve, reject) => {
      this.server.once('error', reject);
      this.server.listen(0, '127.0.0.1', resolve);
    });
    const address = this.server.address();
    if (!address || typeof address === 'string') throw Error('PROXY_START_FAILED');
    return `http://127.0.0.1:${address.port}`;
  }
  async close() {
    for (const socket of this.sockets) socket.destroy();
    await new Promise<void>((resolve) => this.server.close(() => resolve()));
  }
}
