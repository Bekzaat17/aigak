import { useEffect, useState } from 'react';
import type { AuthChallenge } from '../../shared/auth-challenge';
import { getAuthChallenge, submitAuthCode } from '../api/auth-challenges';
export function useAuthChallenge(caseId: string, active: boolean) {
  const [challenge, setChallenge] = useState<AuthChallenge | null>(null);
  const [code, setCode] = useState('');
  const [error, setError] = useState(false);
  const [sending, setSending] = useState(false);
  useEffect(() => {
    const controller = new AbortController();
    let timer: ReturnType<typeof setTimeout>;
    const poll = async () => {
      try {
        const r = await getAuthChallenge(caseId, controller.signal);
        if (!controller.signal.aborted) setChallenge(r.challenge);
      } catch {
        /* Retry without exposing internals. */
      }
      if (!controller.signal.aborted)
        timer = setTimeout(() => {
          void poll();
        }, 1500);
    };
    if (active) void poll();
    return () => {
      controller.abort();
      clearTimeout(timer);
    };
  }, [caseId, active]);
  const submit = async () => {
    if (!challenge || sending) return;
    setSending(true);
    setError(false);
    try {
      await submitAuthCode(caseId, challenge.id, code);
      setCode('');
      setChallenge(null);
    } catch {
      setError(true);
    } finally {
      setSending(false);
    }
  };
  return { challenge, code, setCode, error, sending, submit };
}
