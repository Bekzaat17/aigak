import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { resultDiagnostic } from '../src/features/case-workspace/result-diagnostic';
import { ResultSummary } from '../src/features/case-workspace/ResultSummary';
import { collectionError } from '../server/collection/collection-error';
import type { CaseRecord } from '../shared/types';
function fixture(code: string): CaseRecord {
  return {
    status: 'failed',
    analysisLevel: 'basic',
    useAi: false,
    sourceType: 'url',
    sourceUrl: 'https://example.com',
    evidence: [],
    findings: [],
    redirects: [],
    likelihood: null,
    assessment: { ru: 'Оценка будет сформирована после анализа.', kk: '' },
    step: { ru: 'Сбор', kk: 'Жинау' },
    collection: {
      status: 'unavailable',
      attempts: [
        {
          method: 'http',
          status: 'failed',
          errorCode: code,
          evidenceIds: [],
          textLength: 0,
          startedAt: '',
          durationMs: 100,
        },
      ],
    },
  } as unknown as CaseRecord;
}
test('connection, DNS, certificate, timeout, challenge and unknown failures have distinct observed explanations', () => {
  const cases = [
    ['ECONNREFUSED', 'Сайт отклонил соединение'],
    ['ENOTFOUND', 'Адрес сайта не найден в DNS'],
    ['ERR_CERT_AUTHORITY_INVALID', 'Не удалось установить защищённое соединение'],
    ['FETCH_TIMEOUT', 'Истекло время загрузки сайта'],
    ['CAPTCHA_REQUIRED', 'Защита сайта не пройдена'],
    ['CAPTURE_FAILED', 'Содержимое сайта не получено'],
  ];
  for (const [code, title] of cases)
    assert.equal(resultDiagnostic(fixture(code), 'ru')?.title, title);
});
test('readable successful analysis is not replaced by earlier failed fallback attempts', () => {
  const c = fixture('CAPTCHA_REQUIRED');
  c.status = 'review';
  c.collection!.status = 'adequate';
  c.inspection = {
    stages: [{ id: 'verification', status: 'completed' }],
  } as CaseRecord['inspection'];
  assert.equal(resultDiagnostic(c, 'ru'), undefined);
});
test('pending is not failure; failed AI after successful capture is not site unavailability', () => {
  const c = fixture('');
  c.status = 'queued';
  assert.equal(resultDiagnostic(c, 'ru')?.title, 'Проверка выполняется');
  c.status = 'failed';
  c.collection!.status = 'adequate';
  assert.equal(resultDiagnostic(c, 'ru')?.title, 'Анализ не завершён');
});
test('failed report suppresses placeholder, false probability and instruction to inspect nonexistent materials', () => {
  const c = fixture('ECONNREFUSED');
  c.likelihood = 0;
  const html = renderToStaticMarkup(
    createElement(ResultSummary, { c, lang: 'ru', onReview: () => {} }),
  );
  assert.ok(html.includes('Сайт отклонил соединение'));
  assert.ok(html.includes('Попыток доступа: 1'));
  for (const unwanted of [
    'Оценка будет сформирована',
    'Проверьте полноту материалов',
    'Ход этапов не сохранён',
    'оценка ИИ',
  ])
    assert.ok(!html.includes(unwanted));
});
test('public diagnostics preserve allowlisted errno without leaking raw exception details', () => {
  assert.equal(
    collectionError(
      Object.assign(Error('connect 10.1.2.3 private data'), { code: 'ECONNREFUSED' }),
    ),
    'ECONNREFUSED',
  );
  assert.equal(
    collectionError(Object.assign(Error('password=secret'), { code: 'secret' })),
    'CAPTURE_FAILED',
  );
});
