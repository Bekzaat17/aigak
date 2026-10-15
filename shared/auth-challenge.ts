export interface AuthChallenge {
  id: string;
  kind: 'otp';
  expiresAt: string;
}
