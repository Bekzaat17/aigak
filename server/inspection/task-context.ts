import type { AiTask } from '../ai/contracts';
import type { OsintReport } from '../../shared/osint';

const legalFacts = new Set([
  'organization',
  'business_id',
  'license',
  'registry_match',
  'address',
  'email',
  'phone',
  'social',
  'registrant_organization',
  'registrant_privacy',
  'registration',
]);
/** Role-specific metadata, never truncation of collected source text or law passages. */
export function taskContext(task: AiTask, osint?: OsintReport): OsintReport | undefined {
  if (!osint) return undefined;
  return {
    version: osint.version,
    status: osint.status,
    requestedUrl: osint.requestedUrl,
    finalUrl: osint.finalUrl,
    hostname: osint.hostname,
    registrationDomain: osint.registrationDomain,
    siteDomain: osint.siteDomain,
    observations: osint.observations.filter((o) => legalFacts.has(o.kind)),
    stages: osint.stages.filter((s) =>
      /^(law-|registry|contacts|site-exploration|legal-follow-up)/.test(s.id),
    ),
    ...(task === 'legal' ? { legalNorms: osint.legalNorms } : {}),
    ...(['legal', 'pro_review'].includes(task) ? { registry: osint.registry } : {}),
    ...(task === 'pro_review'
      ? {
          relations: osint.relations?.filter((r) =>
            ['shared_contact', 'shared_business_id', 'similar_content'].includes(r.kind),
          ),
        }
      : {}),
  };
}
