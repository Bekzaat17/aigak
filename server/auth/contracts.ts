import type { Page } from 'playwright';
import type { PublicAuthProfile } from '../../shared/authentication';
export interface AuthForm {
  url: string;
  fields: Record<string, string>;
  submitSelector: string;
  submitUrls: string[];
}
export interface AuthProfile extends PublicAuthProfile {
  login: AuthForm;
  register?: AuthForm;
  successSelector: string;
  readUrls: string[];
  verification?: { endpoint: string; token: string; allowedPathPrefix: string };
}
export interface VerificationInbox {
  waitForLink(profile: AuthProfile, signal: AbortSignal): Promise<string | undefined>;
}
export interface AuthenticatedPage {
  page: Page;
  profile: AuthProfile;
}
