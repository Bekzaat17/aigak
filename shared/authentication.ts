export interface AuthenticationRequest {
  profileId: string;
  mode: 'login' | 'register';
}
export interface AuthenticationReport {
  status: 'authenticated' | 'action_required' | 'failed';
  reason?:
    | 'PROFILE_UNAVAILABLE'
    | 'EMAIL_OR_2FA_REQUIRED'
    | 'AUTH_NOT_CONFIRMED'
    | 'REGISTRATION_ALREADY_ATTEMPTED'
    | 'ACCESS_FAILED';
  mode: 'login' | 'register';
  checkedAt: string;
  evidenceIds: string[];
  durationMs: number;
}
export interface PublicAuthProfile {
  id: string;
  name: string;
  origin: string;
  registration: boolean;
}
