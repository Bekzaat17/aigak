import type { AuthChallenge } from '../../shared/auth-challenge';
import { api } from './client';
export const getAuthChallenge = (id: string, signal: AbortSignal) =>
  api<{ challenge: AuthChallenge | null }>(`/api/cases/${id}/auth-challenge`, { signal });
export const submitAuthCode = (id: string, challengeId: string, code: string) =>
  api<{ ok: true }>(`/api/cases/${id}/auth-challenge`, {
    method: 'POST',
    body: JSON.stringify({ challengeId, code }),
  });
