import type { PublicAuthProfile } from '../../shared/authentication';
import { api } from './client';
export const listAuthProfiles = (signal: AbortSignal) =>
  api<PublicAuthProfile[]>('/api/auth-profiles', { signal });
