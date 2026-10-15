import type { Artifact } from './contracts';
import type { LegalSource } from './legal-catalog';

export interface LegalSourceDocument {
  html: string;
  artifact: Artifact;
}
export interface LegalSourceReader {
  readonly id: string;
  read(source: LegalSource, signal: AbortSignal): Promise<LegalSourceDocument>;
}
