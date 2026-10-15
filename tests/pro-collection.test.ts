import assert from 'node:assert/strict';
import { test } from 'node:test';
import net from 'node:net';
import { PublicEgressProxy } from '../server/collection/browser/PublicEgressProxy';
import { parseAuthProfiles, publicAuthProfiles } from '../server/auth/auth-profiles';
import { collectionError } from '../server/collection/collection-error';
import { compactSources } from '../server/inspection/compact-sources';
import { prompts } from '../server/ai/prompts';
import { UrlCollectionService } from '../server/collection/UrlCollectionService';
import type { CaseRecord, Evidence } from '../shared/types';

test('native proxy denies loopback CONNECT before resolving or opening a socket', async () => {
  let resolved = false;
  const proxy = new PublicEgressProxy(async () => {
    resolved = true;
    return { address: '127.0.0.1', family: 4 };
  });
  const endpoint = new URL(await proxy.start());
  try {
    await new Promise<void>((resolve, reject) => {
      const socket = net.connect(Number(endpoint.port), '127.0.0.1', () =>
        socket.write('CONNECT 127.0.0.1:443 HTTP/1.1\r\nHost: 127.0.0.1:443\r\n\r\n'),
      );
      socket.on('error', reject);
      socket.on('close', () => resolve());
      socket.setTimeout(2000, () => {
        socket.destroy();
        reject(Error('Timeout'));
      });
    });
    assert.equal(resolved, false);
  } finally {
    await proxy.close();
  }
});
const profile = {
  id: 'qa',
  name: 'QA',
  origin: 'https://example.com',
  registration: true,
  login: {
    url: 'https://example.com/login',
    fields: { '#email': 'qa@example.com', '#password': 'synthetic-password' },
    submitSelector: 'button',
    submitUrls: ['https://example.com/login'],
  },
  register: {
    url: 'https://example.com/register',
    fields: { '#email': 'qa@example.com', '#password': 'synthetic-password' },
    submitSelector: 'button',
    submitUrls: ['https://example.com/register'],
  },
  successSelector: '[data-authenticated]',
  readUrls: ['https://example.com/account'],
};
test('profiles reject cross-origin credential submission and expose no credentials through catalog', () => {
  const loaded = parseAuthProfiles(JSON.stringify([profile]));
  const publicValue = JSON.stringify(publicAuthProfiles(loaded));
  assert.ok(!publicValue.includes('synthetic-password'));
  assert.ok(!publicValue.includes('qa@example.com'));
  assert.ok(!publicValue.includes('fields'));
  assert.throws(
    () =>
      parseAuthProfiles(
        JSON.stringify([
          { ...profile, login: { ...profile.login, submitUrls: ['https://evil.example/login'] } },
        ]),
      ),
    /INVALID_AUTH_PROFILES/,
  );
  assert.throws(
    () => parseAuthProfiles(JSON.stringify([{ ...profile, origin: 'http://example.com' }])),
    /INVALID_AUTH_PROFILES/,
  );
});
test('authenticated source attribution survives text deduplication and reaches all review prompts', () => {
  const text = 'A sufficiently long identical casino source repeated to exercise text references.';
  const compact = compactSources([
    { id: 'a', text, sourceUrl: 'https://example.com' },
    { id: 'b', text, sourceUrl: 'https://example.com/account', access: 'authenticated' },
  ] as Evidence[]);
  assert.equal(compact[1].access, 'authenticated');
  assert.ok('textRef' in compact[1]);
  assert.equal(compact[1].textRef, 'a');
  for (const prompt of Object.values(prompts)) assert.ok(prompt.includes('access=authenticated'));
});
test('Pro allocates 300 seconds and keeps subsequent collection strategies after a failed method', async () => {
  const c = { analysisLevel: 'pro', evidence: [], issues: [] } as unknown as CaseRecord;
  const called: string[] = [];
  await new UrlCollectionService({ save: async () => {} }, [
    {
      id: 'http',
      collect: async () => {
        called.push('http');
        throw Error('FETCH_TIMEOUT');
      },
    },
    {
      id: 'native',
      collect: async (record) => {
        called.push('native');
        record.evidence.push({
          id: 'text',
          kind: 'text',
          text: 'Real visible casino content '.repeat(30),
        } as Evidence);
      },
    },
  ]).collect(c);
  assert.deepEqual(called, ['http', 'native']);
  assert.equal(c.collection?.budgetMs, 300000);
  assert.equal(c.collection?.status, 'adequate');
  assert.equal(c.collection?.attempts[0].errorCode, 'FETCH_TIMEOUT');
});
test('browser diagnostics retain network error codes without raw URL or credentials', () => {
  assert.equal(
    collectionError(
      Error('page.goto: net::ERR_CONNECTION_TIMED_OUT at https://example.com/?secret=x'),
    ),
    'ERR_CONNECTION_TIMED_OUT',
  );
  assert.equal(collectionError(Error('password=test sensitive exception')), 'CAPTURE_FAILED');
});

test('independent reviewer can reject a collector result and force a fallback', async () => {
  const record = { analysisLevel: 'pro', evidence: [], issues: [] } as unknown as CaseRecord;
  const calls: string[] = [];
  const method = (id: string, fallback = false) => ({
    id,
    fallback,
    collect: async (c: CaseRecord) => {
      calls.push(id);
      c.evidence.push({
        id,
        kind: 'text',
        text: 'Long but untrusted collected text '.repeat(30),
      } as Evidence);
    },
  });
  await new UrlCollectionService(
    { save: async () => {} },
    [method('first'), method('backup', true)],
    (evidence) => ({
      status: evidence[0].id === 'backup' ? 'adequate' : 'limited',
      textLength: evidence[0].text!.length,
    }),
  ).collect(record);
  assert.deepEqual(calls, ['first', 'backup']);
  assert.equal(record.collection?.attempts[0].status, 'limited');
  assert.equal(record.collection?.status, 'adequate');
});
