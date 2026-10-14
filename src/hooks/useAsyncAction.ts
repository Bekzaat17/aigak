import { useRef, useState } from 'react';
export function useAsyncAction() {
  const pending = useRef(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const run = async (fn: () => Promise<void>) => {
    setError('');
    pending.current++;
    setBusy(true);
    try {
      await fn();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'REQUEST_FAILED');
    } finally {
      pending.current--;
      setBusy(pending.current > 0);
    }
  };
  return { busy, setBusy, error, setError, run };
}
