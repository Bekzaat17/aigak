import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { CaseHeader } from '../src/features/case-workspace/CaseHeader.tsx';
import { AuditTimeline } from '../src/features/inspection-trace/AuditTimeline.tsx';
import { AnalysisLimitations } from '../src/features/case-workspace/AnalysisLimitations.tsx';

test('case header can render independently and blocks export without evidence', () => {
  const html = renderToStaticMarkup(
    createElement(CaseHeader, {
      current: {
        number: 'CASE-1',
        demo: false,
        title: '<script>untrusted</script>',
        createdAt: '2026-10-14T00:00:00Z',
        evidence: [],
      },
      lang: 'ru',
      busy: false,
      processing: false,
      reset: () => {},
      exportZip: async () => {},
    }),
  );
  assert.ok(html.includes('&lt;script&gt;untrusted&lt;/script&gt;'));
  assert.ok(html.includes('disabled=""'));
  assert.ok(html.includes('CASE-1'));
});

test('audit component escapes source-controlled details while preserving the audit hash', () => {
  const html = renderToStaticMarkup(
    createElement(AuditTimeline, {
      lang: 'kk',
      audit: [
        {
          id: 'event',
          at: '2026-10-14T00:00:00Z',
          action: 'evidence.saved',
          detail: '<img src=x onerror=alert(1)>',
          hash: 'verified-hash',
          previousHash: '0',
        },
      ],
    }),
  );
  assert.ok(!html.includes('<img'));
  assert.ok(html.includes('&lt;img'));
  assert.ok(html.includes('<code>verified-hash</code>'));
  assert.ok(html.includes('Материалдармен жұмыс тарихы'));
});

test('limitations remain visible for failed cases and use the selected language', () => {
  const html = renderToStaticMarkup(
    createElement(AnalysisLimitations, {
      current: {
        status: 'failed',
        issues: [{ ru: 'Источник недоступен', kk: 'Дереккөз қолжетімсіз' }],
      },
      lang: 'kk',
    }),
  );
  assert.ok(html.includes('open=""'));
  assert.ok(html.includes('Дереккөз қолжетімсіз'));
  assert.ok(!html.includes('Источник недоступен'));
});
