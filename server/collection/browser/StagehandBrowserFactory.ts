import type { BrowserSessionFactory } from './contracts';
import { openNativeSession } from './open-native-session';
import { StagehandControlObserver } from './StagehandControlObserver';
export class StagehandBrowserFactory {
  constructor(private readonly config: { apiKey: string; model: string; executablePath: string }) {}
  readonly open: BrowserSessionFactory = async (signal, viewport) => {
    const controller = new AbortController();
    const active = AbortSignal.any([signal, controller.signal]);
    const session = await openNativeSession(active, viewport);
    const observer = new StagehandControlObserver(this.config, active);
    return {
      ...session,
      close: async () => {
        controller.abort();
        await session.close();
      },
      observe: async (...args) => {
        signal.throwIfAborted();
        const result = await observer.observe(...args);
        signal.throwIfAborted();
        return result;
      },
    };
  };
}
