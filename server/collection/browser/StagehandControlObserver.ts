import type { AgentAction } from '../../../shared/agent-run';
import { randomUUID } from 'node:crypto';
import { localBrowser, Stagehand } from '@browserbasehq/stagehand';
import type { BrowserSession } from './contracts';
import { browserAgentRole, BROWSER_AGENT_PROMPT_VERSION } from '../../ai/prompts/browser-agent';

/** Model sees a value-free control snapshot in a separate browser, never the authenticated session. */
export class StagehandControlObserver {
  constructor(
    private readonly config: { apiKey: string; model: string; executablePath: string },
    private readonly signal: AbortSignal,
  ) {}
  readonly observe: NonNullable<BrowserSession['observe']> = async (
    page,
    instruction,
    onAction,
  ) => {
    const start = Date.now();
    let browser: Awaited<ReturnType<typeof localBrowser.launch>> | undefined;
    let stagehand: Stagehand | undefined;
    const entry: AgentAction = {
      role: 'browser-navigator',
      action: 'observe-controls',
      status: 'failed',
      reason: 'USAGE_NOT_RECEIVED',
      startedAt: new Date(start).toISOString(),
      durationMs: 0,
      model: this.config.model,
      promptVersion: BROWSER_AGENT_PROMPT_VERSION,
      costUsd: null,
    };
    onAction?.(entry);
    const abort = () => {
      void browser?.close().catch(() => {});
    };
    this.signal.addEventListener('abort', abort, { once: true });
    try {
      this.signal.throwIfAborted();
      const prefix = randomUUID();
      const controls = await page.evaluate((prefix) => {
        return [...document.querySelectorAll('input,button,a[href],select,textarea')]
          .filter((e) => {
            const r = e.getBoundingClientRect();
            const s = getComputedStyle(e);
            return r.width > 0 && r.height > 0 && s.visibility !== 'hidden' && s.display !== 'none';
          })
          .slice(0, 100)
          .map((e, i) => {
            const id = prefix + '-' + i;
            e.setAttribute('data-aigak-control', id);
            const input = e as HTMLInputElement;
            return {
              id,
              tag: e.tagName.toLowerCase(),
              type: input.type || '',
              label: (
                e.getAttribute('aria-label') ||
                [...(input.labels || [])].map((l) => l.textContent).join(' ') ||
                e.getAttribute('placeholder') ||
                e.textContent ||
                ''
              ).slice(0, 250),
              name: e.getAttribute('name') || '',
              href: e.tagName === 'A' ? e.getAttribute('href') || '' : '',
            };
          });
      }, prefix);
      browser = await localBrowser.launch({
        headless: true,
        executablePath: this.config.executablePath,
        preserveUserDataDir: false,
        acceptDownloads: false,
      });
      this.signal.throwIfAborted();
      stagehand = await Stagehand.create({
        browser,
        model: { modelName: `openai/${this.config.model}`, apiKey: this.config.apiKey },
        systemPrompt: browserAgentRole,
        logging: { level: 'off' },
        cache: false,
      });
      this.signal.throwIfAborted();
      const snapshot = await browser.context.newPage();
      await snapshot.evaluate((controls) => {
        document.head.innerHTML =
          '<meta http-equiv="Content-Security-Policy" content="default-src \'none\'; form-action \'none\'">';
        for (const c of controls) {
          const label = document.createElement('label');
          label.textContent = c.label + ' ';
          const node = document.createElement(c.tag);
          node.setAttribute('data-control-id', c.id);
          node.setAttribute('aria-label', c.label);
          if (c.tag === 'input') {
            node.setAttribute('type', c.type);
            node.setAttribute('name', c.name);
          } else node.textContent = c.label;
          if (c.tag === 'a') node.setAttribute('href', '#');
          label.append(node);
          document.body.append(label, document.createElement('br'));
        }
      }, controls);
      const result = await stagehand.observe(instruction, {
        page: snapshot,
        timeout: 20000,
        cache: false,
      });
      const selected: { selector: string; description: string }[] = [];
      for (const a of result.data.slice(0, 8)) {
        const id = await snapshot
          .evaluate((selector) => {
            const node =
              selector.startsWith('xpath=') || selector.startsWith('/')
                ? document.evaluate(
                    selector.replace(/^xpath=/, ''),
                    document,
                    null,
                    XPathResult.FIRST_ORDERED_NODE_TYPE,
                    null,
                  ).singleNodeValue
                : document.querySelector(selector.replace(/^css=/, ''));
            return node instanceof Element ? node.getAttribute('data-control-id') : null;
          }, a.selector)
          .catch(() => null);
        if (id && controls.some((c) => c.id === id))
          selected.push({ selector: `[data-aigak-control="${id}"]`, description: a.description });
      }
      Object.assign(entry, {
        role: 'browser-navigator',
        action: 'observe-controls',
        status: 'completed',
        reason: undefined,
        startedAt: new Date(start).toISOString(),
        durationMs: Date.now() - start,
        model: this.config.model,
        promptVersion: BROWSER_AGENT_PROMPT_VERSION,
        inputTokens: result.metadata.usage.inputTokens,
        outputTokens: result.metadata.usage.outputTokens,
        costUsd: null,
      });
      return selected;
    } catch {
      Object.assign(entry, {
        role: 'browser-navigator',
        action: 'observe-controls',
        status: 'failed',
        reason: 'BROWSER_AGENT_FAILED',
        startedAt: new Date(start).toISOString(),
        durationMs: Date.now() - start,
        model: this.config.model,
        promptVersion: BROWSER_AGENT_PROMPT_VERSION,
        costUsd: null,
      });
      throw Error('BROWSER_AGENT_FAILED');
    } finally {
      this.signal.removeEventListener('abort', abort);
      await stagehand?.close().catch(() => {});
      await browser?.close().catch(() => {});
    }
  };
}
