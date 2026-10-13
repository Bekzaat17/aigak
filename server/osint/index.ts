import { OsintFacade } from './OsintFacade.ts';
import { DnsCollector, RdapCollector, TlsCollector } from './providers.ts';
export function createOsintFacade() {
  return new OsintFacade([new DnsCollector(), new RdapCollector(), new TlsCollector()]);
}
