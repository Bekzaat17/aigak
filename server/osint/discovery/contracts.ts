export interface DiscoveryProvider {
  id: string;
  discover(
    domain: string,
    signal: AbortSignal,
  ): Promise<{ hosts: string[]; bytes: Buffer; url: string }>;
}
