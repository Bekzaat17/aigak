import type { ObservationDraft } from '../contracts.ts';

export const jsonArtifact = (name: string, data: unknown, sourceUrl?: string) => ({
  name,
  mime: 'application/json',
  bytes: Buffer.from(JSON.stringify(data, null, 2)),
  sourceUrl,
});

export function rdapObservations(data: unknown): ObservationDraft[] {
  const d = data as {
    entities?: { vcardArray?: [unknown, unknown[][]]; roles?: string[] }[];
    events?: { eventAction: string; eventDate: string }[];
  };
  const out: ObservationDraft[] = [];
  for (const entity of (d.entities || []).slice(0, 50)) {
    const cards = Array.isArray(entity.vcardArray?.[1]) ? entity.vcardArray[1] : [];
    const field = (key: string) => cards.find((f: unknown[]) => f[0] === key)?.[3];
    const roles = Array.isArray(entity.roles) ? entity.roles : [];
    const name = roles.includes('registrar') ? field('fn') : field('org');
    const value = Array.isArray(name) ? name.join(' ') : name;
    if (
      typeof value === 'string' &&
      value.trim() &&
      (roles.includes('registrar') || roles.includes('registrant'))
    ) {
      out.push({
        artifact: 0,
        kind: roles.includes('registrar') ? 'registrar' : 'registrant_organization',
        value: value.slice(0, 1000),
        status: 'observed',
      });
    }
  }
  for (const e of (d.events || []).slice(0, 20)) {
    if (
      ['registration', 'expiration', 'last changed'].includes(e.eventAction) &&
      typeof e.eventDate === 'string'
    )
      out.push({ artifact: 0, kind: e.eventAction, value: e.eventDate, status: 'observed' });
  }
  return out;
}
