import type { AuthChallenge } from '../../../shared/auth-challenge';
export interface AuthChallenges {
  get(caseId: string): AuthChallenge | null;
  submit(caseId: string, challengeId: string, code: string): void;
  requestCode(caseId: string, signal: AbortSignal): Promise<string | undefined>;
}
