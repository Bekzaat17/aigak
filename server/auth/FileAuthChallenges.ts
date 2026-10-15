import { mkdirSync, readFileSync, writeFileSync, rmSync } from 'node:fs';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { setTimeout } from 'node:timers/promises';
import { z } from 'zod';
import type { AuthChallenges } from '../application/ports/auth-challenges';
import type { AuthChallenge } from '../../shared/auth-challenge';
const schema = z.object({
  id: z.string().uuid(),
  kind: z.literal('otp'),
  expiresAt: z.string().datetime(),
});

/** Short-lived private handoff between API and worker; never part of case/export or AI input. */
export class FileAuthChallenges implements AuthChallenges {
  private readonly directory: string;
  constructor(directory: string) {
    this.directory = path.join(directory, 'auth-interactions');
  }
  private file(id: string, suffix: string) {
    if (!/^[a-f0-9-]{36}$/i.test(id)) throw Error('INVALID_CHALLENGE');
    return path.join(this.directory, id + suffix);
  }
  get(caseId: string): AuthChallenge | null {
    const file = this.file(caseId, '.json');
    try {
      const challenge = schema.parse(JSON.parse(readFileSync(file, 'utf8')));
      if (Date.parse(challenge.expiresAt) <= Date.now()) {
        rmSync(file, { force: true });
        rmSync(this.file(caseId, '.code'), { force: true });
        return null;
      }
      return challenge;
    } catch {
      return null;
    }
  }
  submit(caseId: string, id: string, code: string) {
    const challenge = this.get(caseId);
    if (!challenge || challenge.id !== id || !/^\d{4,10}$/.test(code))
      throw Error('INVALID_CHALLENGE');
    writeFileSync(this.file(caseId, '.code'), JSON.stringify({ id, code }), {
      mode: 0o600,
      flag: 'wx',
    });
  }
  async requestCode(caseId: string, signal: AbortSignal) {
    signal.throwIfAborted();
    mkdirSync(this.directory, { recursive: true, mode: 0o700 });
    const challenge: AuthChallenge = {
      id: randomUUID(),
      kind: 'otp',
      expiresAt: new Date(Date.now() + 45000).toISOString(),
    };
    const file = this.file(caseId, '.json'),
      codeFile = this.file(caseId, '.code');
    rmSync(codeFile, { force: true });
    writeFileSync(file, JSON.stringify(challenge), { mode: 0o600 });
    try {
      while (Date.now() < Date.parse(challenge.expiresAt)) {
        signal.throwIfAborted();
        try {
          const reply = z
            .object({ id: z.string().uuid(), code: z.string().regex(/^\d{4,10}$/) })
            .parse(JSON.parse(readFileSync(codeFile, 'utf8')));
          if (reply.id === challenge.id) return reply.code;
        } catch {
          /* No response yet. */
        }
        await setTimeout(300, undefined, { signal });
      }
    } finally {
      rmSync(file, { force: true });
      rmSync(codeFile, { force: true });
    }
  }
}
