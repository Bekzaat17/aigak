import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { IntakeScreen } from '../src/app/IntakeScreen.tsx';
import { LegalSourceLink } from '../src/features/case-workspace/LegalSourceLink.tsx';

test('MVP intake offers URL only, with no text or file source controls', () => {
  const markup = renderToStaticMarkup(
    createElement(IntakeScreen, {
      lang: 'ru',
      url: '',
      setUrl: () => {},
      busy: false,
      ai: true,
      analysisLevel: 'pro',
      setAnalysisLevel: () => {},
      setDrawer: () => {},
      templates: [],
      templateId: 'builtin',
      setTemplateId: () => {},
      openDemo: async () => {},
      start: async () => {},
    }),
  );
  assert.ok(markup.includes('inputMode="url"'));
  assert.ok(!markup.includes('type="file"'));
  assert.ok(!markup.includes('Текст материала'));
  assert.ok(!markup.includes('Файл или скриншот'));
});
test('legal reference names the actual act and links directly to the official source', () => {
  const html = renderToStaticMarkup(
    createElement(LegalSourceLink, {
      lang: 'ru',
      norm: {
        id: 'law',
        documentId: 'Z030000508_',
        title: { ru: 'О рекламе', kk: 'Жарнама туралы' },
        article: '13',
        sourceUrl: 'https://adilet.zan.kz/rus/docs/Z030000508_',
        quote: 'fixture',
        evidenceId: 'e',
        retrievedAt: '2026-10-14',
        temporalStatus: 'requires_review',
      },
    }),
  );
  assert.ok(html.includes('О рекламе'));
  assert.ok(html.includes('статья'));
  assert.ok(html.includes('13'));
  assert.ok(html.includes('href="https://adilet.zan.kz/rus/docs/Z030000508_"'));
  assert.ok(!html.includes('Об игорном бизнесе'));
});
