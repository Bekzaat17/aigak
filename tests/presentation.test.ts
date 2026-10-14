import assert from 'node:assert/strict';
import { test } from 'node:test';
import { displayObservations, observationLines } from '../shared/osint-presentation.ts';
import type { OsintObservation } from '../shared/osint.ts';
import type { CaseRecord, Evidence, Finding } from '../shared/types.ts';
import { findingImage, linkedHypotheses } from '../src/case-view.ts';
const observation = (kind: string, value: string, id = 'one'): OsintObservation => ({
  id,
  kind,
  value,
  evidenceId: id,
  collector: 'test',
  status: 'observed',
  collectedAt: '2026-10-13',
});
test('contact display normalizes duplicates while retaining all source references', () => {
  const groups = displayObservations(
    [
      observation('phone', '8 (777) 123-45-67'),
      observation('phone', '+7 777 1234567', 'two'),
      observation('email', 'HELLO@example.com', 'a'),
      observation('email', 'hello@example.com', 'b'),
    ],
    'ru',
  );
  assert.equal(groups.length, 2);
  assert.deepEqual(groups[0].lines, ['+7 (777) 123-45-67']);
  assert.equal(groups[0].sources.length, 2);
  assert.equal(groups[1].sources.length, 2);
});
test('DNS and certificates render readable values instead of serialized objects', () => {
  assert.deepEqual(
    observationLines(observation('dns_A', '["1.1.1.1","1.1.1.1","8.8.8.8"]'), 'ru'),
    ['1.1.1.1', '8.8.8.8'],
  );
  assert.deepEqual(
    observationLines(
      observation('dns_MX', '[{"exchange":"mail.example.com","priority":10}]'),
      'ru',
    ),
    ['mail.example.com · приоритет 10'],
  );
  assert.deepEqual(observationLines(observation('dns_TXT', '[["v=spf1 ","-all"]]'), 'ru'), [
    'v=spf1 -all',
  ]);
  assert.deepEqual(
    observationLines(observation('tls_issuer', '{"O":"Example CA","CN":"Issuer"}'), 'ru'),
    ['Example CA', 'Issuer'],
  );
  assert.ok(
    !observationLines(observation('registry_match', '{"unrecognized":"raw"}'), 'ru')
      .join()
      .includes('raw'),
  );
});
test('preview uses the actual OCR source but rejects unverified contextual screenshots', () => {
  const evidence = [
    { id: 'http', method: 'http-get', mime: 'text/html' },
    { id: 'dom', method: 'playwright-dom', parentId: 'http', mime: 'text/html' },
    { id: 'text', parentId: 'http', mime: 'text/plain' },
    { id: 'shot', parentId: 'dom', method: 'playwright-screenshot', mime: 'image/png' },
    { id: 'other', mime: 'image/png' },
  ] as Evidence[];
  const c = { evidence } as CaseRecord;
  const f = { evidenceId: 'text' } as Finding;
  assert.equal(findingImage(c, f), undefined);
  assert.equal(
    findingImage({ ...c, evidence: evidence.filter((e) => e.id !== 'shot') }, f),
    undefined,
  );
  const pdf = {
    evidence: [
      { id: 'pdf', mime: 'application/pdf' },
      { id: 'page1', parentId: 'pdf', mime: 'image/png' },
      { id: 'page2', parentId: 'pdf', mime: 'image/png' },
      { id: 'ocr', parentId: 'page2', mime: 'text/plain' },
    ],
  } as CaseRecord;
  assert.equal(findingImage(pdf, { evidenceId: 'ocr' } as Finding)?.id, 'page2');
});
test('legal links survive final review IDs but do not link by generic category', () => {
  const c = {
    inspection: {
      stages: [
        {
          observations: [{ id: 'old', evidenceId: 'e', quote: 'exact' }],
          legalHypotheses: [{ normId: 'law', findingIds: ['old'] }],
        },
      ],
    },
  } as unknown as CaseRecord;
  assert.equal(
    linkedHypotheses(c, { id: 'new', evidenceId: 'e', quote: 'exact' } as Finding).length,
    1,
  );
  assert.equal(
    linkedHypotheses(c, { id: 'new', evidenceId: 'other', quote: 'exact' } as Finding).length,
    0,
  );
});

test('content conclusion distinguishes unconfirmed rules from an inspector decision', async () => {
  const { contentVerdict } = await import('../src/case-view.ts');
  const c = {
    status: 'review',
    evidence: [{ text: 'казино' }],
    findings: [{ decision: 'pending' }],
  } as CaseRecord;
  assert.equal(contentVerdict(c), 'indicators');
  assert.equal(
    contentVerdict({ ...c, status: 'verified', findings: [{ decision: 'accepted' } as Finding] }),
    'confirmed',
  );
  assert.equal(
    contentVerdict({
      ...c,
      findings: [],
      inspection: { status: 'partial' } as CaseRecord['inspection'],
    }),
    'insufficient',
  );
  assert.equal(contentVerdict({ ...c, findings: [] }), 'not_found');
});
test('URL intake accepts bare, www, protocol-relative, IDN, Markdown and copied links', async () => {
  const { normalizeUrlInput } = await import('../shared/url-input.ts');
  for (const value of [
    ' example.com ',
    'https://example.com',
    '//example.com',
    '[Сайт](https://example.com)',
    'Ссылка: https://example.com',
  ])
    assert.equal(normalizeUrlInput(value), 'https://example.com/');
  assert.equal(normalizeUrlInput('http://www.example.com/path'), 'http://www.example.com/path');
  assert.ok(normalizeUrlInput('пример.рф').startsWith('https://xn--'));
  for (const value of [
    'javascript:alert(1)',
    'file:///etc/passwd',
    'https://name:secret@example.com',
    'несколько слов',
    'https://one.example https://two.example',
  ])
    assert.throws(() => normalizeUrlInput(value));
});
