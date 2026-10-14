import assert from 'node:assert/strict';
import { test } from 'node:test';
import { UrlCollectionService } from '../server/collection/UrlCollectionService.ts';
import type { UrlCollectionMethod } from '../server/collection/contracts.ts';
import type { CaseRecord, Evidence, Finding, InspectionStage } from '../shared/types.ts';
import { pageTextQuality } from '../shared/collection.ts';
import { reliableContentAssessment } from '../shared/content-assessment.ts';
import { currentEvidence } from '../shared/current-evidence.ts';
import { verifiedFindingScreenshot } from '../shared/finding-screenshot.ts';
import { createInspectionFacade } from '../server/inspection/index.ts';
import { contentVerdict, findingImage } from '../src/case-view.ts';
import { StorageFailure } from '../server/application/errors/StorageFailure.ts';

const content =
  'Программное обеспечение для реабилитационных центров. Учёт пациентов, расписание занятий и отчёты сотрудников. '.repeat(
    4,
  );
const evidence = (id: string, text = content): Evidence => ({
  id,
  name: id,
  storedName: id,
  mime: 'text/plain',
  kind: 'text',
  method: 'test',
  size: Buffer.byteLength(text),
  sha256: 'fixture',
  createdAt: new Date().toISOString(),
  text,
});
const record = () =>
  ({ evidence: [], issues: [], links: [], sourceType: 'url' }) as unknown as CaseRecord;
const add = (id: string, text = content, fallback = false): UrlCollectionMethod => ({
  id,
  fallback,
  async collect(c) {
    c.evidence.push(evidence(id, text));
  },
});

test('HTTP timeout does not suppress an interchangeable browser collector', async () => {
  for (const id of ['browser', 'alternative-provider']) {
    const c = record();
    let saves = 0;
    await new UrlCollectionService(
      {
        save: async () => {
          saves++;
        },
      },
      [
        {
          id: 'http',
          async collect() {
            throw Error('FETCH_TIMEOUT');
          },
        },
        add(id),
        add('mobile', 'unused', true),
      ],
    ).collect(c);
    assert.equal(c.collection?.status, 'adequate');
    assert.deepEqual(
      c.collection?.attempts.map((a) => a.status),
      ['failed', 'adequate'],
    );
    assert.equal(c.evidence.length, 1);
    assert.ok(saves >= 2);
  }
});
test('shells and challenge pages trigger fallback, never count as complete collection', async () => {
  assert.equal(pageTextQuality('Olimpbet'), 'limited');
  assert.equal(pageTextQuality('Just a moment ' + content), 'limited');
  const c = record();
  await new UrlCollectionService({ save: async () => {} }, [
    add('http', 'Olimpbet'),
    add('desktop', 'Loading'),
    add('mobile', content, true),
  ]).collect(c);
  assert.equal(c.collection?.attempts.length, 3);
  assert.equal(c.collection?.status, 'adequate');
});
test('all limited captures retain materials and an explicit limitation', async () => {
  const c = record();
  await new UrlCollectionService({ save: async () => {} }, [
    add('http', 'logo'),
    add('browser', ''),
  ]).collect(c);
  assert.equal(c.collection?.status, 'limited');
  assert.equal(c.evidence.length, 2);
  assert.ok(c.issues.length);
});
test('cancellation and storage failures do not become ordinary network failures', async () => {
  const controller = new AbortController();
  controller.abort();
  await assert.rejects(
    new UrlCollectionService({ save: async () => {} }, [add('never')]).collect(
      record(),
      controller.signal,
    ),
  );
  await assert.rejects(
    new UrlCollectionService({ save: async () => {} }, [
      {
        id: 'storage',
        async collect() {
          throw new StorageFailure('WRITE_FAILED');
        },
      },
    ]).collect(record()),
    StorageFailure,
  );
});
test('legal gaps do not erase a completed negative content result or its numeric estimate', async () => {
  const result = await createInspectionFacade({
    available: true,
    async analyze() {
      return {
        findings: [],
        assessment: { ru: 'Признаки не найдены', kk: 'Белгілер табылмады' },
        likelihood: 2,
        review: { status: 'not_found', uncertainties: [], questions: [], contradictions: [] },
      };
    },
  }).inspect({
    analysisLevel: 'pro',
    links: [],
    evidence: [evidence('site')],
    collection: { status: 'adequate', attempts: [] },
  });
  assert.equal(result.run.status, 'partial');
  assert.equal(result.likelihood, 2);
  const c = {
    ...record(),
    evidence: [evidence('site')],
    findings: [],
    status: 'review',
    inspection: result.run,
    collection: { status: 'adequate', attempts: [] },
  } as CaseRecord;
  assert.equal(contentVerdict(c), 'not_found');
  assert.equal(
    reliableContentAssessment(result.run.stages, { status: 'limited', attempts: [] }),
    false,
  );
  assert.equal(
    contentVerdict({ ...c, collection: { status: 'limited', attempts: [] } }),
    'insufficient',
  );
});
test('missing content prerequisites suppress numeric confidence', () => {
  assert.equal(
    reliableContentAssessment([{ id: 'verification', status: 'completed' } as InspectionStage]),
    false,
  );
});
test('a screenshot must belong to this exact quotation and source; unavailable never selects a random image', () => {
  const f = {
    id: 'f',
    evidenceId: 'text',
    quote: 'Ставка 100 тенге',
    visualEvidence: { status: 'verified', screenshotId: 'shot' },
  } as Finding;
  const shot = {
    ...evidence('shot'),
    mime: 'image/png',
    method: 'finding-screenshot',
    capture: { textEvidenceId: 'text', visibleText: f.quote, quality: 'adequate', scrollY: 0 },
  } as Evidence;
  assert.equal(verifiedFindingScreenshot(f, [shot])?.id, 'shot');
  assert.equal(verifiedFindingScreenshot({ ...f, quote: 'Ставка 1000 тенге' }, [shot]), undefined);
  assert.equal(verifiedFindingScreenshot({ ...f, evidenceId: 'other' }, [shot]), undefined);
  assert.equal(
    findingImage(
      { ...record(), evidence: [shot] },
      { ...f, visualEvidence: { status: 'unavailable', reason: 'PAGE_CHANGED' } },
    ),
    undefined,
  );
});
test('refreshed collection excludes obsolete capture text without deleting originals', () => {
  const old = { ...evidence('old'), method: 'http-get' };
  const child = { ...evidence('child'), parentId: 'old' };
  const fresh = { ...evidence('new'), method: 'playwright-dom' };
  const c = {
    evidence: [old, child, fresh, evidence('manual')],
    collection: { status: 'adequate', attempts: [{ evidenceIds: ['new'] }] },
  } as Pick<CaseRecord, 'evidence' | 'collection'>;
  assert.deepEqual(
    currentEvidence(c).map((e) => e.id),
    ['new', 'manual'],
  );
  assert.equal(c.evidence.length, 4);
});

test('prompt requires concise findings and separates legal gaps from negative content', async () => {
  const { common } = await import('../server/ai/prompts/common.ts');
  const { legal } = await import('../server/ai/prompts/legal.ts');
  const { PROMPT_VERSION } = await import('../server/ai/prompts/index.ts');
  assert.equal(PROMPT_VERSION, 'advanced/1.5.0');
  assert.ok(common.includes('shortest self-contained sentence'));
  assert.ok(common.includes('unavailable legal or infrastructure sources alone'));
  assert.ok(legal.includes('document title and article explicitly'));
});

test('AI confidence uses integer percentage points and rejects a fractional-scale answer', async () => {
  const { parseAnalysis, outputSchema, SCHEMA_VERSION } = await import('../server/ai/schema.ts');
  const body = {
    likelihood: 0.99,
    assessment: { ru: 'Оценка', kk: 'Баға' },
    findings: [],
    review: { status: 'not_found', uncertainties: [], questions: [], contradictions: [] },
  };
  assert.throws(() => parseAnalysis(JSON.stringify(body), []), /AI_INVALID_RESPONSE/);
  assert.equal(parseAnalysis(JSON.stringify({ ...body, likelihood: 99 }), []).likelihood, 99);
  assert.equal(outputSchema.properties.likelihood.type, 'integer');
  assert.equal(SCHEMA_VERSION, 'inspection/2.1.0');
});

test('successful current stages do not display stale failures from an earlier revision', async () => {
  const { currentIssues } = await import('../shared/current-issues.ts');
  const c = {
    issues: [
      { ru: 'Юрист: Этап не выполнен', kk: 'Қате' },
      { ru: 'Неполный сбор страницы', kk: 'Толық емес' },
    ],
    findings: [],
    inspection: {
      stages: [{ id: 'legal', name: { ru: 'Юрист', kk: 'Заңгер' }, status: 'completed' }],
    },
  } as unknown as Pick<CaseRecord, 'issues' | 'findings' | 'inspection'>;
  assert.deepEqual(
    currentIssues(c).map((i) => i.ru),
    ['Неполный сбор страницы'],
  );
  assert.equal(c.issues.length, 2);
});
