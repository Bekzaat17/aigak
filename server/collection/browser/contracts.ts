import type { BrowserContext } from 'playwright';
export interface BrowserSession {
  context: BrowserContext;
  close(): Promise<void>;
}
export type BrowserSessionFactory = (
  signal: AbortSignal,
  viewport: { width: number; height: number },
) => Promise<BrowserSession>;
