import type { AgentAction } from '../../../shared/agent-run';
import type { BrowserContext, Page } from 'playwright';
export interface BrowserSession {
  context: BrowserContext;
  preparePage?: (page: Page, onAction?: (action: AgentAction) => void) => Promise<void>;
  observe?: (
    page: Page,
    instruction: string,
    onAction?: (action: AgentAction) => void,
  ) => Promise<{ selector: string; description: string }[]>;
  close(): Promise<void>;
}
export type BrowserSessionFactory = (
  signal: AbortSignal,
  viewport: { width: number; height: number },
) => Promise<BrowserSession>;
