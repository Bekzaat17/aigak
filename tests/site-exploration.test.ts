import assert from 'node:assert/strict';
import { test } from 'node:test';
import { PublishedPagePlanner } from '../server/osint/PublishedPagePlanner';
import { SiteExplorationStage } from '../server/application/processing/SiteExplorationStage';
import { LegalFollowUpStage } from '../server/application/processing/LegalFollowUpStage';
import { collectPublicPage } from '../server/application/collection/collect-public-page';
import { processingPolicy } from '../server/bootstrap/processing-policy';
import { reviewCollectionAttempt } from '../server/domain/review-collection-attempt';
import { buildDossier } from '../shared/dossier';
import { taskContext } from '../server/inspection/task-context';
import type { CaseRecord, Evidence, InspectionStage } from '../shared/types';
import type {
  CollectedArtifacts,
  CollectionStrategy,
} from '../server/application/ports/collection';

const bi = { ru: 'test', kk: 'test' };
const source = (url: string, text = 'A neutral home page'): Evidence => ({
  id: url,
  name: 'source.html',
  storedName: '',
  mime: 'text/html',
  kind: 'original',
  method: 'test',
  sourceUrl: url,
  text,
  sha256: '',
  size: 0,
  createdAt: new Date().toISOString(),
});
const stage = (id: string): InspectionStage => ({
  id,
  version: '1',
  status: 'completed',
  name: bi,
  startedAt: '2026-10-15',
  durationMs: 1,
  summary: bi,
  observations: [],
  findingIds: [],
});
const record = (): CaseRecord =>
  ({
    id: 'test',
    sourceUrl: 'https://example.kz/',
    evidence: [],
    links: [],
    issues: [],
    findings: [],
    analysisLevel: 'pro',
    assessment: bi,
    engine: 'ai',
    likelihood: 0,
    clarifications: [],
    status: 'review',
    collection: { status: 'adequate', budgetMs: 1000, attempts: [] },
    osint: { version: '1', status: 'partial', observations: [], stages: [] },
    inspection: {
      level: 'pro',
      version: '1',
      status: 'completed',
      startedAt: '2026-10-15',
      completedAt: '2026-10-15',
      aiCalls: 5,
      aiAttempts: 5,
      stages: ['verification', 'legal', 'pro_review'].map(stage),
    },
  }) as unknown as CaseRecord;
const empty = (): CollectedArtifacts => ({ artifacts: [], links: [], issues: [], redirects: [] });
const storage = () => ({
  async addEvidence(
    c: CaseRecord,
    bytes: Buffer,
    input: Omit<Evidence, 'id' | 'storedName' | 'size' | 'sha256' | 'createdAt'>,
  ) {
    const e = {
      ...source('https://example.kz/'),
      ...input,
      id: 'saved-' + c.evidence.length,
      size: bytes.length,
    };
    c.evidence.push(e);
    return e;
  },
  async event() {},
});
const strategy: CollectionStrategy = {
  id: 'browser',
  timeoutMs: 1000,
  async run(c) {
    return {
      ...empty(),
      artifacts: [
        {
          evidence: {
            ...source(c.sourceUrl!, 'Sports stakes and odds. '.repeat(20)),
            kind: 'text',
            mime: 'text/plain',
          },
          bytes: Buffer.from('source'),
        },
      ],
    };
  },
};

test('page planner includes internal routes, prioritizes casino, excludes actions and off-origin links', () => {
  const c = record();
  delete c.collection;
  c.evidence = [source(c.sourceUrl!)];
  const planner = new PublishedPagePlanner(
    {
      read: () =>
        Buffer.from(
          '<a href="/about">About</a><a href="/casino">Casino</a><a href="/#/slots">Slots</a><a href="/logout">Logout</a><a href="https://outside.kz/casino">Casino</a><a href="/delete?id=1">Delete</a><a href="/terms">Rules</a>',
        ),
    },
    'site',
  );
  assert.deepEqual(
    planner.plan(c).map((p) => p.url),
    [
      'https://example.kz/casino',
      'https://example.kz/#/slots',
      'https://example.kz/terms',
      'https://example.kz/about',
    ],
  );
  const legal = new PublishedPagePlanner(
    {
      read: () =>
        Buffer.from(
          '<a href="/casino">Casino</a><a href="/line/aussie_rules-118">Australian rules football</a><a href="/terms">Rules</a>',
        ),
    },
    'legal',
  );
  assert.deepEqual(
    legal.plan(c).map((p) => p.url),
    ['https://example.kz/terms'],
  );
});
test('a neutral home page does not stop exploration: inner page and depth-two source are collected', async () => {
  const c = record();
  const requested: string[] = [];
  const planner = {
    plan: () => [
      {
        url: requested.length ? 'https://example.kz/casino/offer' : 'https://example.kz/casino',
        purpose: bi,
      },
    ],
  };
  await new SiteExplorationStage(
    storage(),
    planner,
    [
      {
        ...strategy,
        async run(snapshot, signal) {
          requested.push(snapshot.sourceUrl!);
          return strategy.run(snapshot, signal);
        },
      },
    ],
    reviewCollectionAttempt,
    { pageLimit: 2, depth: 2 },
  ).execute(c);
  assert.deepEqual(requested, ['https://example.kz/casino', 'https://example.kz/casino/offer']);
  assert.equal(c.collection?.attempts.length, 2);
  assert.ok(c.evidence.every((e) => e.sourceUrl !== c.sourceUrl));
  assert.match(c.osint!.stages[0].summary.ru, /начат сбор 2/);
});
test('fallback survives provider failure and timeout; cancellation does not persist late artifacts', async () => {
  const c = record();
  const failure: CollectionStrategy = {
    id: 'bad',
    timeoutMs: 100,
    async run() {
      throw Error('private detail');
    },
  };
  const result = await collectPublicPage(
    storage(),
    c,
    'https://example.kz/casino',
    [failure, strategy],
    reviewCollectionAttempt,
    AbortSignal.timeout(1000),
    'test',
  );
  assert.equal(result.available, true);
  assert.equal(c.collection!.attempts[0].errorCode, 'STRATEGY_FAILED');
  const controller = new AbortController();
  controller.abort();
  const count = c.evidence.length;
  await assert.rejects(
    collectPublicPage(
      storage(),
      c,
      'https://example.kz/casino',
      [strategy],
      reviewCollectionAttempt,
      controller.signal,
      'test',
    ),
  );
  assert.equal(c.evidence.length, count);
});
test('legal feedback rechecks new evidence once and retains both histories and token call totals', async () => {
  const c = record();
  let calls = 0;
  await new LegalFollowUpStage(
    storage(),
    { plan: () => [{ url: 'https://example.kz/terms', purpose: bi }] },
    [strategy],
    reviewCollectionAttempt,
    {
      async inspect(input) {
        calls++;
        assert.ok(input.evidence.some((e) => e.sourceUrl?.endsWith('/terms')));
        return {
          findings: [],
          assessment: { ru: 'Rechecked', kk: 'Rechecked' },
          likelihood: null,
          engine: 'ai',
          issues: [],
          run: structuredClone(c.inspection!),
        };
      },
    },
  ).execute(c);
  assert.equal(calls, 1);
  assert.equal(c.assessment.ru, 'Rechecked');
  assert.equal(c.inspection!.aiCalls, 10);
  assert.equal(c.inspection!.stages.filter((s) => s.id === 'legal').length, 1);
  assert.ok(c.inspection!.stages.some((s) => s.id === 'initial-legal'));
});
test('failed legal reassessment preserves earlier findings and requires further analysis', async () => {
  const c = record();
  await new LegalFollowUpStage(
    storage(),
    { plan: () => [{ url: 'https://example.kz/terms', purpose: bi }] },
    [strategy],
    reviewCollectionAttempt,
    {
      async inspect() {
        const run = structuredClone(c.inspection!);
        run.stages[1].status = 'failed';
        return {
          findings: [],
          assessment: { ru: 'Wrong', kk: 'Wrong' },
          likelihood: null,
          engine: 'ai',
          issues: [],
          run,
        };
      },
    },
  ).execute(c);
  assert.equal(c.assessment.ru, 'test');
  assert.equal(c.materialsPending, true);
  assert.equal(c.inspection!.stages.find((s) => s.id === 'legal')!.status, 'completed');
});
test('quality policy is configurable; content tasks omit legal corpus; failed HTTP cannot be adequate', () => {
  assert.equal(processingPolicy({}).budgetMs, 900000);
  assert.equal(processingPolicy({ AIGAK_ANALYSIS_BUDGET_MS: '1800000' }).budgetMs, 1800000);
  assert.throws(() => processingPolicy({ AIGAK_SITE_PAGE_LIMIT: 'Infinity' }));
  const osint = record().osint!;
  osint.legalNorms = [];
  assert.equal(taskContext('context', osint)!.legalNorms, undefined);
  assert.equal(taskContext('legal', osint)!.legalNorms, osint.legalNorms);
  const e = { ...source('https://example.kz/', 'casino '.repeat(100)), kind: 'text' as const };
  assert.notEqual(reviewCollectionAttempt([e], 'HTTP_ERROR').status, 'adequate');
});
test('accepting a finding without a matched screenshot never makes visual proof ready', () => {
  const c = record();
  c.evidence = [source('https://example.kz/casino', 'casino')];
  c.findings = [
    {
      id: 'f',
      scope: 'target',
      decision: 'accepted',
      quote: 'casino',
      start: 0,
      end: 6,
      evidenceId: c.evidence[0].id,
      title: bi,
      explanation: bi,
      category: 'test',
      engine: 'ai',
    },
  ];
  assert.equal(buildDossier(c).tasks.find((t) => t.id === 'visual-proof')!.status, 'missing');
  assert.equal(buildDossier(c).ready, false);
});

test('sitemaps discover a nested target even when the home page is unavailable', async () => {
  const { SitemapCollector } = await import('../server/osint/collectors/SitemapCollector');
  const { domainTarget } = await import('../server/osint/domain');
  const collector = new SitemapCollector(async (url) => ({
    url,
    status: 200,
    headers: {},
    redirects: [],
    body: Buffer.from(
      url.endsWith('/robots.txt')
        ? 'Sitemap: https://example.kz/sitemap.xml'
        : '<urlset><url><loc>https://example.kz/mega-casino</loc></url><url><loc>http://127.0.0.1/private</loc></url><url><loc>https://other.kz/foreign</loc></url></urlset>',
    ),
  }));
  const result = await collector.collect(
    domainTarget('https://example.kz/'),
    new AbortController().signal,
  );
  assert.deepEqual(
    result.observations.map((o) => o.value),
    ['https://example.kz/mega-casino'],
  );
  const c = record();
  c.collection!.status = 'unavailable';
  c.evidence = [
    {
      ...source('https://example.kz/sitemap.xml'),
      id: 'map',
      mime: 'application/xml',
      kind: 'metadata',
    },
  ];
  c.osint!.observations = result.observations.map((o) => ({
    ...o,
    id: 'o',
    evidenceId: 'map',
    collectedAt: '2026-10-15',
    collector: 'sitemap',
  }));
  assert.deepEqual(
    new PublishedPagePlanner({ read: () => Buffer.from('') }, 'site').plan(c).map((p) => p.url),
    ['https://example.kz/mega-casino'],
  );
});

test('completed analysis stages and token usage survive a later analyzer failure', async () => {
  const { InspectionStage } = await import('../server/application/processing/InspectionStage');
  const c = record();
  const completed = stage('context');
  completed.aiAttempts = [
    {
      profile: 'test',
      adapter: 'test',
      requestedModel: 'test',
      promptVersion: '1',
      schemaVersion: '1',
      startedAt: '2026-10-15',
      durationMs: 10,
      status: 'completed',
      inputTokens: 120,
      outputTokens: 30,
    },
  ];
  await assert.rejects(
    new InspectionStage(storage(), {
      async inspect(_input, onStage) {
        await onStage!(completed);
        throw Error('ANALYZER_STOPPED');
      },
    }).execute(c),
    /ANALYZER_STOPPED/,
  );
  assert.equal(c.inspection!.stages[0].aiAttempts![0].inputTokens, 120);
  assert.equal(c.inspection!.aiAttempts, 1);
  assert.equal(c.inspection!.status, 'partial');
});

test('explicit visual revalidation invalidates old proofs before work and persists failure', async () => {
  const { reverifyCaseEvidence } = await import('../server/application/reverify-case-evidence');
  const c = record();
  c.findings = [
    {
      id: 'f',
      evidenceId: 'e',
      quote: 'fact',
      start: 0,
      end: 4,
      category: 'payment',
      title: bi,
      explanation: bi,
      engine: 'ai',
      decision: 'pending',
      visualEvidence: {
        status: 'verified',
        screenshotId: 'old',
        verifiedAt: '2026-10-15',
        method: 'exact-visible-text-before-and-after-capture',
      },
    },
  ];
  const events: string[] = [];
  const store = {
    get: async () => c,
    event: async (r: CaseRecord, action: string) => {
      events.push(action);
      if (action.endsWith('started')) assert.equal(r.findings[0].visualEvidence, undefined);
    },
  };
  await assert.rejects(
    reverifyCaseEvidence(c.id, store, {
      verify: async () => {
        throw Error('FAIL');
      },
    }),
    /FAIL/,
  );
  assert.equal(c.findings[0].visualEvidence?.status, 'unavailable');
  assert.deepEqual(events, ['visual-revalidation.started', 'visual-revalidation.failed']);
  c.status = 'queued';
  await assert.rejects(reverifyCaseEvidence(c.id, store, { verify: async () => {} }), /CASE_BUSY/);
  c.status = 'verified';
  await assert.rejects(
    reverifyCaseEvidence(c.id, store, { verify: async () => {} }),
    /INSPECTOR_REVIEW_ALREADY_COMPLETED/,
  );
});
