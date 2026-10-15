import assert from 'node:assert/strict';
import { test } from 'node:test';
import { compactSources } from '../server/inspection/compact-sources.ts';
import { GatewayAnalyzer } from '../server/inspection/GatewayAnalyzer.ts';
import { loadAiConfig, parseAiConfig } from '../server/ai/config.ts';
import {
  ResponsesAdapter,
  ChatCompletionsAdapter,
  type HttpTransport,
} from '../server/ai/adapters.ts';
import type { ModelGateway } from '../server/ai/contracts.ts';
import type { Evidence } from '../shared/types.ts';

function evidence(id: string, text: string, sourceUrl?: string): Evidence {
  return {
    id,
    text,
    sourceUrl,
    name: id,
    storedName: id,
    mime: 'text/plain',
    size: text.length,
    sha256: '',
    method: 'test',
    createdAt: '',
    kind: 'text',
  };
}

test('identical source texts are shared while every source keeps its attribution', () => {
  const text = 'Контекст новости: «казино бонус депозит» — цитата. '.repeat(100);
  const sources = [
    evidence('a', text, 'https://a.test'),
    evidence('b', text, 'https://b.test'),
    evidence('c', text + 'Не играйте.'),
    evidence('empty', '  '),
  ];
  const original = structuredClone(sources);
  const packed = compactSources(sources);
  assert.equal(packed.length, 3);
  assert.deepEqual(packed[1], { id: 'b', sourceUrl: 'https://b.test', textRef: 'a' });
  assert.ok('text' in packed[2]);
  assert.equal(packed[2].text, text + 'Не играйте.');
  assert.ok(JSON.stringify(packed).length < JSON.stringify(sources).length * 0.75);
  assert.deepEqual(sources, original);
});

test('compaction does not normalize whitespace, change quotations or create reference chains', () => {
  const text = 'Құмар ойын туралы жаңалық.\n  Бұл жарнама емес.';
  const packed = compactSources([
    evidence('a', text),
    evidence('b', text),
    evidence('c', text),
    evidence('d', text.replace('\n  ', ' ')),
    evidence('e', 'x'),
    evidence('f', 'x'),
  ]);
  assert.ok('textRef' in packed[1]);
  assert.equal(packed[1].textRef, 'a');
  assert.ok('textRef' in packed[2]);
  assert.equal(packed[2].textRef, 'a');
  assert.ok('text' in packed[3]);
  assert.equal(packed[3].text, text.replace('\n  ', ' '));
  assert.ok('text' in packed[5]);
  assert.equal(packed[5].text, 'x');
});

test('quotes against a shared source are validated against its original text and id', async () => {
  const text = 'Новость: обсуждается реклама казино, это не предложение играть.';
  const gateway: ModelGateway = {
    available: true,
    async complete(_task, request, versions, _signal, _observer, validate) {
      const payload = JSON.parse(request.input);
      assert.equal(payload.sources[1].textRef, 'a');
      assert.equal(payload.inspectorStatements, undefined);
      assert.ok(request.instructions.includes('textRef'));
      assert.equal(versions.promptVersion, 'advanced/1.7.0');
      const bi = { ru: 'Новость', kk: 'Жаңалық' };
      return validate(
        JSON.stringify({
          likelihood: 0,
          assessment: bi,
          findings: [],
          review: {
            status: 'not_found',
            uncertainties: [],
            questions: [],
            contradictions: [
              { evidenceId: 'b', quote: 'это не предложение играть', explanation: bi },
            ],
          },
        }),
      );
    },
  };
  const result = await new GatewayAnalyzer(gateway).analyze(
    [evidence('a', text), evidence('b', text)],
    { signal: new AbortController().signal, task: 'context' },
  );
  assert.equal(result.review?.contradictions[0].evidenceId, 'b');
});

test('default economy settings and explicit model overrides stay configurable', () => {
  const config = loadAiConfig({});
  assert.equal(config.profiles.default.model, 'gpt-6-luna');
  assert.equal(config.profiles.default.reasoningEffort, 'low');
  assert.equal(config.profiles.default.retries, 0);
  assert.equal(
    loadAiConfig({ OPENAI_MODEL: 'other-model' }).profiles.default.reasoningEffort,
    undefined,
  );
  assert.equal(
    loadAiConfig({ OPENAI_MODEL: 'other-model', OPENAI_REASONING_EFFORT: 'medium' }).profiles
      .default.reasoningEffort,
    'medium',
  );
  assert.throws(() => loadAiConfig({ OPENAI_REASONING_EFFORT: 'invalid' }), /INVALID_AI_CONFIG/);
  assert.equal(parseAiConfig(config).profiles.default.model, 'gpt-6-luna');
});

test('both adapters serialize configurable reasoning budgets without affecting legacy profiles', async () => {
  const profile = loadAiConfig({}).profiles.default;
  const request = { instructions: 'test', input: 'test', schema: {}, schemaName: 'test' };
  for (const reasoningEffort of [undefined, 'low'] as const) {
    const transport: HttpTransport = async (url, options) => {
      const body = JSON.parse(options!.body as string);
      if (String(url).endsWith('/responses')) {
        assert.deepEqual(body.reasoning, reasoningEffort ? { effort: reasoningEffort } : undefined);
        assert.equal(body.max_output_tokens, profile.maxOutputTokens);
        return Response.json({
          status: 'completed',
          output: [{ content: [{ type: 'output_text', text: '{}' }] }],
        });
      }
      assert.equal(body.reasoning_effort, reasoningEffort);
      assert.equal(
        body.max_completion_tokens,
        reasoningEffort ? profile.maxOutputTokens : undefined,
      );
      assert.equal(body.max_tokens, reasoningEffort ? undefined : profile.maxOutputTokens);
      return Response.json({ choices: [{ finish_reason: 'stop', message: { content: '{}' } }] });
    };
    for (const adapter of [new ResponsesAdapter(transport), new ChatCompletionsAdapter(transport)])
      await adapter.complete(
        { ...profile, reasoningEffort },
        'test',
        request,
        new AbortController().signal,
      );
  }
});
