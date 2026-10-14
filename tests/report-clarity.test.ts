import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import type { CaseRecord, Evidence } from '../shared/types';
import type { LegalNorm } from '../shared/osint';
import { legalSourceTitle } from '../shared/legal-source';
import { primaryMaterials } from '../src/case-view';
import { materialLabel } from '../src/features/case-workspace/material-label';
import { LawWorkspace } from '../src/features/case-workspace/LawWorkspace';
import { AccessObservations } from '../src/features/case-workspace/AccessObservations';
import { publishedResources } from '../src/features/resource-graph/published-resources';
import { HelpPanel } from '../src/features/navigation/HelpPanel';

const norm: LegalNorm = {
  id: 'KZ-Z070000219-article-9',
  article: '9',
  quote: 'Статья 9. Лицензирование деятельности в сфере игорного бизнеса',
  evidenceId: 'law',
  sourceUrl: 'https://old.adilet.zan.kz/rus/docs/Z070000219_',
  retrievedAt: '2026-10-14T00:00:00Z',
  temporalStatus: 'requires_review',
};
function fixture() {
  return {
    id: 'case',
    sourceUrl: 'https://example.com/',
    links: [],
    findings: [],
    evidence: [],
    analysisLevel: 'pro',
    osint: {
      legalNorms: [norm],
      observations: [],
      relations: [],
      registry: {
        sourceDate: '2026-05-05',
        evidenceId: 'registry',
        matches: [
          {
            organization: 'Тестовый оператор',
            license: '12345',
            bin: '000000000001',
            website: 'https://example.com',
            matchedBy: ['exact_domain'],
            row: 1,
          },
        ],
      },
    },
    inspection: {
      stages: [
        {
          id: 'legal',
          status: 'completed',
          summary: { ru: 'Нарушение не подтверждено.', kk: 'Бұзушылық расталмады.' },
          legalHypotheses: [],
        },
      ],
    },
  } as unknown as CaseRecord;
}
test('completed legal review with no violation hypothesis still shows license, dated registry and named legal sources', () => {
  const c = fixture();
  c.evidence.push({ id: 'registry', sourceUrl: 'https://www.gov.kz/example.xlsx' } as Evidence);
  const html = renderToStaticMarkup(
    createElement(LawWorkspace, { c, lang: 'ru', onFinding: () => {} }),
  );
  for (const value of [
    '12345',
    '2026-05-05',
    'Тестовый оператор',
    'Об игорном бизнесе',
    'статья',
    '9',
    'https://old.adilet.zan.kz/rus/docs/Z070000219_',
    'https://www.gov.kz/example.xlsx',
    'Действие лицензии на дату этой проверки не подтверждено',
  ])
    assert.ok(html.includes(value), value);
  assert.ok(!html.includes('Проверьте доступность ИИ'));
  assert.ok(!html.includes('Правовые гипотезы не сформированы'));
});
test('law titles are resolved by official document identity rather than guessed from article numbers', () => {
  assert.ok(legalSourceTitle(norm, 'ru').includes('Об игорном бизнесе'));
  assert.equal(
    legalSourceTitle(
      {
        ...norm,
        sourceUrl: 'https://untrusted.test/Z070000219_',
        title: { ru: 'Другой акт', kk: 'Басқа акт' },
      },
      'ru',
    ),
    'Другой акт',
  );
  assert.ok(
    legalSourceTitle(
      { ...norm, article: '13', sourceUrl: 'https://adilet.zan.kz/rus/docs/Z030000508_' },
      'ru',
    ).includes('О рекламе'),
  );
});
test('public relationships preserve profile paths and source, excluding IP and certificate-only claims', () => {
  const c = fixture();
  c.links = [
    'https://t.me/example_channel',
    'https://apps.example.com/',
    'https://example.com/line',
    'javascript:alert(1)',
    'https://1.1.1.1/',
  ];
  c.osint!.relations = [
    { to: 'unrelated.example.org', kind: 'certificate_contains' },
    { to: '8.8.8.8', kind: 'resolves_to' },
  ] as NonNullable<CaseRecord['osint']>['relations'];
  const resources = publishedResources(c);
  assert.deepEqual(
    resources.map((r) => r.url),
    ['https://t.me/example_channel', 'https://apps.example.com/'],
  );
  assert.equal(resources[0].sourceUrl, c.sourceUrl);
});
test('technical candidate text is archived but absent from the main materials', () => {
  const c = fixture();
  const e = {
    id: 'candidate',
    method: 'detective-text@1',
    kind: 'text',
    mime: 'text/plain',
    name: 'candidate-apps.example.com.txt',
    text: '×',
    sourceUrl: 'https://apps.example.com/',
  } as Evidence;
  c.evidence = [e];
  assert.deepEqual(primaryMaterials(c), []);
  assert.equal(c.evidence.length, 1);
  assert.equal(materialLabel(c, e, 'ru'), 'Проверка связанного ресурса · apps.example.com');
});
test('access differences are reported without alleging intentional evasion', () => {
  const c = fixture();
  c.collection = {
    status: 'adequate',
    attempts: [
      {
        method: 'http',
        status: 'limited',
        durationMs: 10,
        textLength: 8,
        evidenceIds: ['response'],
        startedAt: '',
      },
      {
        method: 'browser-desktop',
        status: 'adequate',
        durationMs: 100,
        textLength: 1297,
        evidenceIds: ['browser'],
        startedAt: '',
      },
    ],
  };
  const html = renderToStaticMarkup(createElement(AccessObservations, { c, lang: 'ru' }));
  assert.ok(html.includes('1297'));
  assert.ok(html.includes('/api/cases/case/evidence/response'));
  assert.ok(html.includes('Намеренное сокрытие или обход проверки не установлены'));
});
test('help describes URL workflow and omits administrator secrets and setup instructions', () => {
  for (const lang of ['ru', 'kk'] as const) {
    const html = renderToStaticMarkup(createElement(HelpPanel, { lang, ai: true }));
    assert.ok(!/OPENAI_|\.env|AI подключён/.test(html));
  }
});

test('access signals use current collected responses and preserve the exact challenge source', async () => {
  const { accessSignals } = await import('../src/features/case-workspace/access-signals');
  const c = fixture();
  c.evidence = [
    { id: 'challenge', kind: 'text', text: 'Verify you are human to continue' },
    { id: 'old', kind: 'text', text: 'Access denied' },
  ] as Evidence[];
  c.collection = {
    status: 'limited',
    attempts: [
      {
        method: 'http',
        status: 'limited',
        durationMs: 1,
        textLength: 37,
        evidenceIds: ['challenge'],
        startedAt: '',
      },
    ],
  };
  assert.deepEqual(
    accessSignals(c).challenges.map((e) => e.id),
    ['challenge'],
  );
  const html = renderToStaticMarkup(createElement(AccessObservations, { c, lang: 'ru' }));
  assert.ok(html.includes('Verify you are human to continue'));
  assert.ok(html.includes('/api/cases/case/evidence/challenge'));
  assert.ok(!html.includes('Access denied'));
});
