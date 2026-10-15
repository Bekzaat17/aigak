import type { AuthProfile, VerificationInbox } from './contracts';
import { setTimeout } from 'node:timers/promises';
/** Optional trusted mailbox connector. It returns a link, never mailbox contents to the model. */
export class VerificationInboxClient implements VerificationInbox {
  async waitForLink(profile: AuthProfile, signal: AbortSignal) {
    if (!profile.verification) return;
    const { endpoint, token, allowedPathPrefix } = profile.verification;
    for (let attempt = 0; attempt < 6; attempt++) {
      signal.throwIfAborted();
      const response = await fetch(endpoint, {
        headers: { Authorization: 'Bearer ' + token },
        signal: AbortSignal.any([signal, AbortSignal.timeout(5000)]),
        redirect: 'error',
      });
      if (response.ok) {
        const length = Number(response.headers.get('content-length'));
        if (length > 8192) throw Error('INBOX_RESPONSE_INVALID');
        const reader = response.body?.getReader();
        if (!reader) throw Error('INBOX_RESPONSE_INVALID');
        const chunks: Uint8Array[] = [];
        let bytes = 0;
        try {
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            bytes += value.byteLength;
            if (bytes > 8192) throw Error('INBOX_RESPONSE_INVALID');
            chunks.push(value);
          }
        } finally {
          await reader.cancel();
        }
        const raw = Buffer.concat(chunks).toString('utf8');
        const body: unknown = JSON.parse(raw);
        if (
          body &&
          typeof body === 'object' &&
          'verificationUrl' in body &&
          typeof body.verificationUrl === 'string'
        ) {
          const url = new URL(body.verificationUrl);
          if (
            url.origin !== profile.origin ||
            url.username ||
            url.password ||
            !url.pathname.startsWith(allowedPathPrefix)
          )
            throw Error('VERIFICATION_LINK_REJECTED');
          return url.href;
        }
      } else await response.body?.cancel();
      await setTimeout(3000, undefined, { signal });
    }
  }
}
