import type { PublicAuthProfile } from '../../../shared/authentication';
export interface AuthProfileCatalog {
  list(): PublicAuthProfile[];
}
