import { useEffect, useState } from 'react';
import type { PublicAuthProfile } from '../../shared/authentication';
import { listAuthProfiles } from '../api/authentication';
export function useAuthenticationOptions() {
  const [profiles, setProfiles] = useState<PublicAuthProfile[]>([]);
  const [profileId, setProfileId] = useState('');
  const [mode, setMode] = useState<'login' | 'register'>('login');
  useEffect(() => {
    const c = new AbortController();
    void listAuthProfiles(c.signal)
      .then((p) => {
        if (!c.signal.aborted) setProfiles(p);
      })
      .catch(() => {});
    return () => c.abort();
  }, []);
  return { profiles, profileId, setProfileId, mode, setMode };
}
