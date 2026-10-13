import type {Evidence,Localized} from '../../shared/types.ts';
import type {OsintObservation,OsintReport} from '../../shared/osint.ts';
export interface DomainTarget {
 url:string; hostname:string; unicodeHostname:string;
 registrationDomain?:string; siteDomain?:string;
}
export interface Artifact {
 name:string; mime:string; bytes:Buffer; sourceUrl?:string; text?:string;
}
export type ObservationDraft = Omit<OsintObservation,'id'|'evidenceId'|'collectedAt'|'collector'> & {artifact:number};
export interface CollectorResult {
 status:'completed'|'partial'|'skipped'; summary:Localized;
 artifacts:Artifact[]; observations:ObservationDraft[];
}
export interface DomainCollector {
 readonly id:string; readonly version:string;
 collect(target:DomainTarget,signal:AbortSignal):Promise<CollectorResult>;
}
export interface OsintInput {url?:string;finalUrl?:string;evidence:Evidence[]}
export interface OsintResult {report:OsintReport}
export type SaveArtifact = (artifact:Artifact,collector:string)=>Evidence;
