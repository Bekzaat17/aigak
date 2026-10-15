import { randomBytes } from 'node:crypto';
import { setTimeout } from 'node:timers/promises';
import { z } from 'zod';
import type { AuthProfile, VerificationInbox } from './contracts';

/** Dedicated short-lived mailbox per authorized registration. Credentials never leave this adapter. */
export class MailTmInbox implements VerificationInbox {
  private readonly boxes = new Map<string, { token: string; id: string; address: string }>();
  constructor(private readonly request: typeof fetch = fetch) {}
  private async call(
    path: string,
    signal: AbortSignal,
    token?: string,
    body?: object,
  ): Promise<unknown> {
    const response = await this.request('https://api.mail.tm' + path, {
      method: body ? 'POST' : 'GET',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: 'Bearer ' + token } : {}),
      },
      ...(body ? { body: JSON.stringify(body) } : {}),
      signal: AbortSignal.any([signal, AbortSignal.timeout(8000)]),
      redirect: 'error',
    });
    if (!response.ok) {
      await response.body?.cancel();
      throw Error('MAILBOX_UNAVAILABLE');
    }
    const reader = response.body?.getReader();
    if (!reader) throw Error('MAILBOX_UNAVAILABLE');
    let size = 0;
    const parts: Uint8Array[] = [];
    try {
      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        size += value.length;
        if (size > 256000) throw Error('MAILBOX_RESPONSE_TOO_LARGE');
        parts.push(value);
      }
    } finally {
      await reader.cancel();
    }
    return JSON.parse(Buffer.concat(parts).toString('utf8')) as unknown;
  }
  async create(id: string, signal: AbortSignal) {
    if (this.boxes.has(id)) throw Error('MAILBOX_ALREADY_EXISTS');
    const domains = z
      .object({ 'hydra:member': z.array(z.object({ domain: z.string(), isActive: z.boolean() })) })
      .parse(await this.call('/domains', signal));
    const domain = domains['hydra:member'].find((d) => d.isActive)?.domain;
    if (!domain || !/^[a-z0-9.-]+$/i.test(domain)) throw Error('MAILBOX_UNAVAILABLE');
    const address = 'aigak-' + randomBytes(10).toString('hex') + '@' + domain;
    const password = randomBytes(24).toString('base64url') + '!9aA';
    const account = z
      .object({ id: z.string() })
      .parse(await this.call('/accounts', signal, undefined, { address, password }));
    const access = z
      .object({ token: z.string() })
      .parse(await this.call('/token', signal, undefined, { address, password }));
    this.boxes.set(id, { token: access.token, id: account.id, address });
    return { address, password };
  }
  supports(profile: AuthProfile) {
    return this.boxes.has(profile.id);
  }
  async waitForLink(profile: AuthProfile, signal: AbortSignal) {
    const box = this.boxes.get(profile.id);
    if (!box) return;
    for (let attempt = 0; attempt < 8; attempt++) {
      const messages = z
        .object({ 'hydra:member': z.array(z.object({ id: z.string() })) })
        .parse(await this.call('/messages', signal, box.token));
      for (const message of messages['hydra:member'].slice(0, 5)) {
        const body = z
          .object({ text: z.string().optional(), html: z.array(z.string()).optional() })
          .parse(await this.call('/messages/' + encodeURIComponent(message.id), signal, box.token));
        const text = [body.text || '', ...(body.html || [])].join('\n').replaceAll('&amp;', '&');
        for (const match of text.matchAll(/https:\/\/[^\s<>"']+/g)) {
          try {
            const url = new URL(match[0]);
            if (
              url.origin === profile.origin &&
              !url.username &&
              !url.password &&
              /verify|confirm|activate/i.test(url.pathname)
            )
              return url.href;
          } catch {
            /* Ignore malformed email links. */
          }
        }
      }
      await setTimeout(2500, undefined, { signal });
    }
  }
  async release(id: string) {
    const box = this.boxes.get(id);
    this.boxes.delete(id);
    if (!box) return;
    await this.request('https://api.mail.tm/accounts/' + encodeURIComponent(box.id), {
      method: 'DELETE',
      headers: { Authorization: 'Bearer ' + box.token },
      signal: AbortSignal.timeout(5000),
      redirect: 'error',
    })
      .then((r) => r.body?.cancel())
      .catch(() => {});
  }
}
