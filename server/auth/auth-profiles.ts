import { z } from 'zod';
import { parsePublicUrl } from '../domain/public-url';
import type { AuthProfile } from './contracts';
const form = z.object({
  url: z.string().url(),
  fields: z
    .record(z.string().min(1), z.string().min(1))
    .refine((f) => Object.keys(f).length > 0 && Object.keys(f).length <= 15),
  submitSelector: z.string().min(1),
  submitUrls: z.array(z.string().url()).min(1).max(5),
});
const schema = z
  .array(
    z.object({
      id: z.string().regex(/^[a-z0-9_-]{1,60}$/),
      name: z.string().min(1).max(100),
      origin: z.string().url(),
      registration: z.boolean().default(false),
      login: form,
      register: form.optional(),
      successSelector: z.string().min(1),
      readUrls: z.array(z.string().url()).min(1).max(4),
      verification: z
        .object({
          endpoint: z.string().url(),
          token: z.string().min(1),
          allowedPathPrefix: z.string().startsWith('/').min(2),
        })
        .optional(),
    }),
  )
  .max(20);
/** Only bootstrap reads secrets. Application and API receive public descriptors. */
export function parseAuthProfiles(value: string | undefined): AuthProfile[] {
  if (!value) return [];
  try {
    const profiles = schema.parse(JSON.parse(value));
    if (new Set(profiles.map((p) => p.id)).size !== profiles.length) throw Error();
    for (const p of profiles) {
      const origin = parsePublicUrl(p.origin);
      if (origin.protocol !== 'https:' || origin.origin !== p.origin) throw Error();
      for (const url of [
        ...p.readUrls,
        p.login.url,
        ...p.login.submitUrls,
        ...(p.register ? [p.register.url, ...p.register.submitUrls] : []),
      ])
        if (parsePublicUrl(url).origin !== p.origin) throw Error();
      if (p.registration && !p.register) throw Error();
      if (p.verification && parsePublicUrl(p.verification.endpoint).protocol !== 'https:')
        throw Error();
    }
    return profiles;
  } catch {
    throw Error('INVALID_AUTH_PROFILES');
  }
}
export function publicAuthProfiles(profiles: AuthProfile[]) {
  return profiles.map(({ id, name, origin, registration }) => ({ id, name, origin, registration }));
}
