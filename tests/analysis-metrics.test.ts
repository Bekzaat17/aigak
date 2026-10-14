import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { summarizeAiUsage } from '../shared/ai-usage.ts';
import type { AiAttempt, InspectionRun } from '../shared/types.ts';
import { AnalysisMetrics } from '../src/features/inspection-trace/AnalysisMetrics.tsx';
import { TokenUsage } from '../src/features/inspection-trace/TokenUsage.tsx';
import { formatDuration } from '../src/lib/format-duration.ts';

const attempt: AiAttempt = {
  profile: 'default',
  adapter: 'responses',
  requestedModel: 'test',
  promptVersion: '1',
  schemaVersion: '1',
  startedAt: '2026-10-14T00:00:00Z',
  durationMs: 1000,
  status: 'completed',
  inputTokens: 100,
  outputTokens: 20,
};

test('usage includes retries and keeps incomplete measurements distinct from zero', () => {
  assert.deepEqual(
    summarizeAiUsage([attempt, { ...attempt, status: 'failed', outputTokens: undefined }], 3),
    {
      inputTokens: 200,
      outputTokens: 20,
      missingInput: 1,
      missingOutput: 2,
      missingUsageAttempts: 2,
    },
  );
  const html = renderToStaticMarkup(
    createElement(TokenUsage, { attempts: [], expectedAttempts: 1, lang: 'ru' }),
  );
  assert.ok(html.includes('нет данных'));
  assert.ok(!html.includes('<strong>0</strong>'));
  const basic = renderToStaticMarkup(createElement(TokenUsage, { attempts: [], lang: 'ru' }));
  assert.ok(basic.includes('<strong>0</strong>'));
  const partial = renderToStaticMarkup(
    createElement(TokenUsage, { attempts: [attempt], expectedAttempts: 2, lang: 'kk' }),
  );
  assert.ok(partial.includes('≥ 120'));
  assert.ok(partial.includes('Барлық әрекеттердің'));
});

test('overall duration uses current revision rather than case age or human review time', () => {
  const inspection: InspectionRun = {
    level: 'basic',
    version: '1',
    status: 'completed',
    startedAt: '2026-10-14T01:00:10Z',
    completedAt: '2026-10-14T01:00:20Z',
    aiCalls: 0,
    aiAttempts: 0,
    stages: [],
  };
  const current = {
    createdAt: '2026-10-13T00:00:00Z',
    completedAt: '2026-10-14T01:00:30Z',
    inspection,
    audit: [
      {
        id: 'r',
        at: '2026-10-14T01:00:00Z',
        action: 'revision.started',
        detail: '',
        previousHash: '',
        hash: '',
      },
    ],
  };
  const html = renderToStaticMarkup(createElement(AnalysisMetrics, { current, lang: 'ru' }));
  assert.ok(html.includes('<dd>30 с</dd>'));
  assert.ok(html.includes('<dd>10 с</dd>'));
  const pending = renderToStaticMarkup(
    createElement(AnalysisMetrics, {
      current: {
        ...current,
        audit: [{ ...current.audit[0], at: '2026-10-14T02:00:00Z' }],
      },
      lang: 'ru',
    }),
  );
  assert.ok(pending.includes('Расход токенов неизвестен'));
  assert.ok(!pending.includes('<strong>0</strong>'));
  assert.equal(formatDuration(125000, 'ru'), '2 мин 5 с');
  assert.equal(formatDuration(-1, 'ru'), 'нет данных');
});
