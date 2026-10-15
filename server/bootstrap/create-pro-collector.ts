import { CollectionOrchestrator } from '../application/collection/CollectionOrchestrator';
import { IsolatedCollectionStrategy } from '../collection/IsolatedCollectionStrategy';
import { HttpCollectionMethod } from '../collection/HttpCollectionMethod';
import { BrowserCollectionMethod } from '../collection/BrowserCollectionMethod';
import { AgentBrowserCollectionMethod } from '../collection/AgentBrowserCollectionMethod';
import { openNativeSession } from '../collection/browser/open-native-session';
import { openInterceptedSession } from '../collection/browser/open-intercepted-session';
import type { BrowserSessionFactory } from '../collection/browser/contracts';
import type { CollectionStorage } from '../collection/contracts';
import { reviewCollectionAttempt } from '../domain/review-collection-attempt';
import { createExtraction } from './create-extraction';
export function createProCollector(
  store: CollectionStorage,
  directory: string,
  agentBrowser?: BrowserSessionFactory,
) {
  const browser = (id: string, open: BrowserSessionFactory, mobile = false) =>
    new IsolatedCollectionStrategy(
      id,
      50000,
      (memory) =>
        new BrowserCollectionMethod(
          id,
          memory,
          createExtraction(memory, directory),
          mobile ? { width: 430, height: 932 } : { width: 1440, height: 1000 },
          false,
          open,
        ),
    );
  return new CollectionOrchestrator(
    store,
    [
      {
        fallback: false,
        strategies: [
          new IsolatedCollectionStrategy(
            'http',
            30000,
            (memory) => new HttpCollectionMethod(memory, createExtraction(memory, directory)),
          ),
          browser('browser-native', openNativeSession),
        ],
      },
      {
        fallback: true,
        strategies: [
          browser('browser-desktop', openInterceptedSession),
          browser('browser-mobile', openNativeSession, true),
        ],
      },
      ...(agentBrowser
        ? [
            {
              fallback: false,
              strategies: [
                new IsolatedCollectionStrategy(
                  'browser-agent',
                  65000,
                  (memory) =>
                    new AgentBrowserCollectionMethod(
                      memory,
                      createExtraction(memory, directory),
                      agentBrowser,
                    ),
                ),
              ],
            },
          ]
        : []),
    ],
    reviewCollectionAttempt,
    170000,
  );
}
