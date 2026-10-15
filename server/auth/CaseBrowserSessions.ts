import type { AuthenticatedPage } from './contracts';
import type { BrowserSession } from '../collection/browser/contracts';
/** Per-processor resource owner. Credentials/cookies stay in memory, never in case JSON. */
export class CaseBrowserSessions {
  private readonly active = new Map<string, AuthenticatedPage & BrowserSession>();
  set(id: string, session: AuthenticatedPage & BrowserSession) {
    this.active.set(id, session);
  }
  get(id: string) {
    return this.active.get(id);
  }
  async release(id: string) {
    const session = this.active.get(id);
    this.active.delete(id);
    await session?.close();
  }
}
