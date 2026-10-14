import { summarizeAiUsage } from '../shared/ai-usage.ts';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { createInspectionFacade } from '../server/inspection/index.ts';
import { createAiAnalyzer } from '../server/inspection/provider.ts';
import type { Evidence } from '../shared/types.ts';

// Explicit opt-in: transmits only synthetic fixtures and incurs provider usage.
if (!process.argv.includes('--live'))
  throw new Error(
    'Pass --live to transmit synthetic RU/KK fixtures. Add --case=ru-offer for one case (3 stages); all cases run 18 stages. Configured retries may add requests.',
  );
const analyzer = createAiAnalyzer();
if (!analyzer.available) throw new Error('AI_NOT_CONFIGURED');
const allFixtures = JSON.parse(
  readFileSync(new URL('../config/ai-eval.json', import.meta.url), 'utf8'),
) as { id: string; text: string; expected: string[] }[];
const selectedCase = process.argv.find((arg) => arg.startsWith('--case='))?.slice(7);
const fixtures =
  selectedCase === undefined
    ? allFixtures
    : allFixtures.filter((fixture) => fixture.id === selectedCase);
if (!fixtures.length) throw new Error('UNKNOWN_EVAL_CASE');
const inspector = createInspectionFacade(analyzer);
let passed = 0,
  attempts = 0,
  inputTokens = 0,
  outputTokens = 0,
  missingUsageAttempts = 0;
for (const fixture of fixtures) {
  const evidence: Evidence = {
    id: fixture.id,
    name: fixture.id + '.txt',
    storedName: fixture.id + '.txt',
    mime: 'text/plain',
    size: Buffer.byteLength(fixture.text),
    sha256: createHash('sha256').update(fixture.text).digest('hex'),
    text: fixture.text,
    kind: 'text',
    method: 'synthetic eval',
    createdAt: new Date().toISOString(),
  };
  const result = await inspector.inspect({
    analysisLevel: 'advanced',
    evidence: [evidence],
    links: [],
  });
  const final = result.run.stages.find((s) => s.id === 'verification');
  const actual = final?.review?.status;
  const ok = result.run.status === 'completed' && !!actual && fixture.expected.includes(actual);
  if (ok) passed++;
  attempts += result.run.aiAttempts || 0;
  const aiAttempts = result.run.stages.flatMap((stage) => stage.aiAttempts || []);
  const usage = summarizeAiUsage(aiAttempts, result.run.aiAttempts ?? result.run.aiCalls);
  inputTokens += usage.inputTokens;
  outputTokens += usage.outputTokens;
  missingUsageAttempts += usage.missingUsageAttempts;
  console.log(
    JSON.stringify({
      id: fixture.id,
      ok,
      expected: fixture.expected,
      actual: actual ?? null,
      status: result.run.status,
      findings: result.findings.length,
      attempts: result.run.aiAttempts,
      usage,
      models: result.run.stages
        .flatMap((s) => s.aiAttempts || [])
        .map((a) => a.actualModel || a.requestedModel),
      errors: result.run.stages.filter((s) => s.errorCode).map((s) => s.errorCode),
    }),
  );
}
console.log(
  JSON.stringify({
    passed,
    total: fixtures.length,
    attempts,
    inputTokens,
    outputTokens,
    missingUsageAttempts,
    note: 'Small synthetic smoke set, not an accuracy benchmark.',
  }),
);
if (passed !== fixtures.length) process.exitCode = 1;
