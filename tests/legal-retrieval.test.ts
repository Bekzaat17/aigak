import assert from 'node:assert/strict';
import { test } from 'node:test';
import { AdiletApiReader } from '../server/osint/AdiletApiReader';
import { LegalCorpusService } from '../server/osint/LegalCorpusService';
import type { LegalSource } from '../server/osint/legal-catalog';
import type { LegalSourceReader } from '../server/osint/legal-source-reader';
import type { OsintReport } from '../shared/osint';
import type { Evidence } from '../shared/types';

const source: LegalSource = {
  id: 'Z070000219_',
  url: 'https://old.adilet.zan.kz/rus/docs/Z070000219_',
  title: { ru: 'Об игорном бизнесе', kk: 'Ойын бизнесі туралы' },
  identity: '12 января 2007 года',
  articles: ['6'],
};
const html = `<body><p>${source.identity}</p><h3>Статья 6. Виды деятельности</h3><p>${'Проверяемая норма. '.repeat(12)}</p><h3>Статья 7. Следующая</h3><p>Не относится</p></body>`;
const response = (body: unknown) => ({
  status: 200,
  body: Buffer.from(JSON.stringify(body)),
  url: source.url,
  headers: {},
  redirects: [],
});
const doc = {
  id: '0f40c77b-3d3f-48f1-b17d-b968c9506a76',
  group_number: source.id,
  title_ru: source.title.ru,
  title_kz: `Закон от ${source.identity}`,
  language: 'rus',
  is_actual: true,
  in_force: true,
};
const report = (): OsintReport => ({
  version: '1',
  status: 'partial',
  observations: [],
  stages: [],
});

test('official API rejects historical, ambiguous and wrong-document matches before accepting content', async () => {
  const get = async () => response({ document_id: doc.id, text_content: html });
  for (const results of [
    [{ ...doc, is_actual: false }],
    [{ ...doc, group_number: 'OTHER' }],
    [doc, doc],
    [{ ...doc, title_kz: 'Wrong date' }],
  ]) {
    const reader = new AdiletApiReader(get, async () => response({ results }));
    await assert.rejects(reader.read(source, new AbortController().signal), /IDENTITY/);
  }
  const mismatch = new AdiletApiReader(
    async () => response({ document_id: 'different', text_content: html }),
    async () => response({ results: [doc] }),
  );
  await assert.rejects(mismatch.read(source, new AbortController().signal), /IDENTITY/);
  const reader = new AdiletApiReader(get, async () => response({ results: [doc] }));
  const result = await reader.read(source, new AbortController().signal);
  assert.ok(result.html.includes(source.identity));
  assert.equal(result.artifact.sourceUrl, 'https://adilet.zan.kz/rus/docs/' + doc.id);
  assert.equal(JSON.parse(result.artifact.bytes.toString()).document.group_number, source.id);
});

test('legal reader substitution preserves exact articles, saved source and fallback after format failure', async () => {
  const good: LegalSourceReader = {
    id: 'working',
    async read() {
      return {
        html,
        artifact: {
          name: 'law.html',
          mime: 'text/html',
          bytes: Buffer.from(html),
          sourceUrl: source.url,
        },
      };
    },
  };
  const bad: LegalSourceReader = {
    id: 'invalid-format',
    async read() {
      return {
        html: '<body>Empty shell</body>',
        artifact: { name: 'bad', mime: 'text/html', bytes: Buffer.from('bad') },
      };
    },
  };
  for (const readers of [[good], [bad, good]]) {
    const r = report();
    await new LegalCorpusService(readers, [source]).enrich(
      r,
      (a) => ({ id: 'saved', createdAt: '2026-10-15', ...a }) as unknown as Evidence,
    );
    assert.equal(r.legalNorms?.length, 1);
    assert.equal(r.legalNorms[0].evidenceId, 'saved');
    assert.equal(r.legalNorms[0].sourceUrl, source.url);
    assert.ok(!r.legalNorms[0].quote.includes('Не относится'));
    assert.equal(r.stages.at(-1)?.status, 'completed');
  }
});

test('cancellation prevents persistence and fallback legal requests', async () => {
  const controller = new AbortController();
  let saves = 0,
    fallbacks = 0;
  const first: LegalSourceReader = {
    id: 'cancel',
    async read() {
      controller.abort();
      throw Error('aborted');
    },
  };
  const next: LegalSourceReader = {
    id: 'never',
    async read() {
      fallbacks++;
      throw Error('unexpected');
    },
  };
  await assert.rejects(
    new LegalCorpusService([first, next], [source]).enrich(
      report(),
      () => {
        saves++;
        throw Error('unexpected');
      },
      controller.signal,
    ),
  );
  assert.equal(saves, 0);
  assert.equal(fallbacks, 0);
});

test('registry adapter neither requests nor replaces legal corpus', async () => {
  const { OfficialSourcesService, REGISTRY_URL } =
    await import('../server/osint/OfficialSourcesService');
  const r = report();
  r.legalNorms = [];
  const original = r.legalNorms;
  const urls: string[] = [];
  await new OfficialSourcesService(async (u) => {
    urls.push(u);
    throw Error('offline');
  }).enrich(r, () => {
    throw Error('unexpected');
  });
  assert.deepEqual(urls, [REGISTRY_URL]);
  assert.equal(r.legalNorms, original);
});

test('legal answer receives one grounded repair without relaxing exact quote checks', async () => {
  const { verifiedLegalAnalysis } = await import('../server/inspection/verified-legal-analysis');
  const { AiError } = await import('../server/ai/contracts');
  const norms = [
    { id: 'norm', quote: 'Exact official quote' },
  ] as import('../shared/osint').LegalNorm[];
  const findings = [{ id: 'finding' }] as import('../shared/types').Finding[];
  let calls = 0;
  const request = { instructions: 'legal', input: '{}', schema: {}, schemaName: 'legal' };
  const valid = {
    assessment: { ru: 'Вывод', kk: 'Баға' },
    hypotheses: [
      {
        normId: 'norm',
        citationId: 'n0p0',
        findingIds: ['finding'],
        reason: { ru: 'Причина', kk: 'Себеп' },
        missing: [{ ru: 'Проверка', kk: 'Тексеру' }],
      },
    ],
  };
  const gateway: import('../server/ai/contracts').ModelGateway = {
    available: true,
    async complete(_task, req, versions, _signal, _observer, validate) {
      calls++;
      if (calls === 2) {
        assert.ok(req.instructions.includes('VALIDATION REPAIR'));
        assert.equal(versions.promptVersion, 'legal-repair/2.0.0');
      }
      return validate(
        JSON.stringify(
          calls === 1
            ? {
                ...valid,
                hypotheses: [{ ...valid.hypotheses[0], citationId: 'not-a-supplied-citation' }],
              }
            : valid,
        ),
      );
    },
  };
  const result = await verifiedLegalAnalysis(
    gateway,
    request,
    norms,
    findings,
    new AbortController().signal,
    { beforeAttempt() {}, onAttempt() {} },
  );
  assert.equal(calls, 2);
  assert.equal(result.legalHypotheses[0].normQuote, norms[0].quote);
  calls = 0;
  const refusal: import('../server/ai/contracts').ModelGateway = {
    available: true,
    async complete() {
      calls++;
      throw new AiError('AI_REFUSAL');
    },
  };
  await assert.rejects(
    verifiedLegalAnalysis(refusal, request, norms, findings, new AbortController().signal, {
      beforeAttempt() {},
      onAttempt() {},
    }),
    /AI_REFUSAL/,
  );
  assert.equal(calls, 1);
});

test('legal citations preserve exact source spans and cannot resolve an ID under a different norm', async () => {
  const { legalCitations, resolveLegalCitations } = await import('../server/ai/legal-citations');
  const norms = [
    { id: 'law', quote: 'Full legal clause with exceptions. '.repeat(40) },
  ] as import('../shared/osint').LegalNorm[];
  const citations = legalCitations(norms);
  assert.ok(citations.length > 1);
  assert.ok(citations.every((c) => c.text.length <= 600 && norms[0].quote.includes(c.text)));
  assert.equal(
    citations
      .map((c) => c.text)
      .join(' ')
      .replace(/\s+/g, ' ')
      .trim(),
    norms[0].quote.replace(/\s+/g, ' ').trim(),
  );
  const resolved = JSON.parse(
    resolveLegalCitations(
      JSON.stringify({
        assessment: { ru: 'a', kk: 'b' },
        hypotheses: [{ normId: 'law', citationId: citations[0].id }],
      }),
      citations,
    ),
  );
  assert.equal(resolved.hypotheses[0].normQuote, citations[0].text);
  assert.throws(
    () =>
      resolveLegalCitations(
        JSON.stringify({ hypotheses: [{ normId: 'other', citationId: citations[0].id }] }),
        citations,
      ),
    /AI_UNGROUNDED/,
  );
});

test('official reads may overlap but evidence writes serialize; storage failure is not a reader failure', async () => {
  const sources = [source, { ...source, id: 'SECOND' }];
  let active = 0,
    peak = 0;
  const reader: LegalSourceReader = {
    id: 'official',
    async read() {
      return {
        html,
        artifact: {
          name: 'law.html',
          mime: 'text/html',
          bytes: Buffer.from(html),
          sourceUrl: source.url,
        },
      };
    },
  };
  const r = report();
  await new LegalCorpusService([reader], sources).enrich(r, async () => {
    active++;
    peak = Math.max(peak, active);
    await new Promise((resolve) => setTimeout(resolve, 5));
    active--;
    return { id: 'law-' + r.stages.length, createdAt: '2026-10-15' } as Evidence;
  });
  assert.equal(peak, 1);
  assert.equal(r.legalNorms!.length, 2);
  const failed = report();
  await assert.rejects(
    new LegalCorpusService([reader], sources).enrich(failed, async () => {
      throw Error('CASE_CONFLICT');
    }),
    /CASE_CONFLICT/,
  );
  assert.ok(!failed.stages.some((s) => s.id.startsWith('law-attempt-')));
});
