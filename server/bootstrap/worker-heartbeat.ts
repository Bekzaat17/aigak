import { writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

/** Container liveness probe; never stored with case evidence. */
export function workerHeartbeat() {
  const file = path.join(tmpdir(), 'aigak-worker-heartbeat');
  const beat = () => writeFileSync(file, String(Date.now()), { mode: 0o600 });
  beat();
  const timer = setInterval(beat, 5000);
  timer.unref();
  return () => {
    clearInterval(timer);
    rmSync(file, { force: true });
  };
}
