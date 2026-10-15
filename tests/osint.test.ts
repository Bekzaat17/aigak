import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { test } from 'node:test';
import { extractContacts } from '../server/osint/contacts.ts';
import { domainTarget } from '../server/osint/domain.ts';
import { OsintFacade } from '../server/osint/OsintFacade.ts';
import { rdapObservations } from '../server/osint/providers.ts';
import { contactPageLinks } from '../server/osint/site-pages.ts';
import { maskPersonalIds } from '../shared/osint.ts';
import type { Evidence } from '../shared/types.ts';
function source(text: string): Evidence {
  return {
    id: 'e',
    name: 'test.txt',
    storedName: 'test.txt',
    mime: 'text/plain',
    size: 0,
    sha256: '',
    createdAt: '2026-10-13T00:00:00Z',
    kind: 'text',
    method: 'fixture',
    text,
  };
}
test('domain parsing separates registry domain and private tenant boundary, rejects unsafe URLs', () => {
  const target = domainTarget('https://shop.example.co.uk/a');
  assert.equal(target.registrationDomain, 'example.co.uk');
  assert.equal(domainTarget('https://tenant.github.io').siteDomain, 'tenant.github.io');
  assert.equal(domainTarget('https://tenant.github.io').registrationDomain, 'github.io');
  assert.ok(domainTarget('https://пример.рф').hostname.startsWith('xn--'));
  assert.equal(domainTarget('https://пример.рф').unicodeHostname, 'пример.рф');
  for (const url of ['http://127.0.0.1', 'http://169.254.169.254', 'file:///etc/passwd'])
    assert.throws(() => domainTarget(url));
});
test('RU/KK contact extraction preserves sources and does not interpret every twelve digits as BIN', () => {
  const text =
    'ТОО «Учебная компания»\nБСН: 123456789012\nЖСН: 987654321012\nТелефон: +7 (777) 123-45-67\nEmail: office@example.com\nМекенжай: Алматы, үлгі көшесі 1\nЛицензия № ABC-123\nhttps://t.me/example\nНомер заказа 111111111111';
  const observations = extractContacts([source(text)]);
  for (const kind of [
    'business_id',
    'sensitive_identifier',
    'organization',
    'phone',
    'email',
    'address',
    'license',
    'social',
  ])
    assert.ok(
      observations.some((o) => o.kind === kind),
      kind,
    );
  assert.equal(observations.filter((o) => o.kind === 'business_id').length, 1);
  const masked = observations.find((o) => o.kind === 'sensitive_identifier')!;
  assert.equal(masked.status, 'masked');
  assert.ok(!JSON.stringify(observations).includes('987654321012'));
  assert.ok(observations.every((o) => o.evidenceId === 'e' && typeof o.start === 'number'));
  assert.equal(observations.find((o) => o.kind === 'email')!.value, 'office@example.com');
});
test('IIN masking does not erase separately labelled organizational BIN', () => {
  const text = maskPersonalIds('ИИН: 987654321012; БИН: 123456789012');
  assert.ok(!text.includes('987654321012'));
  assert.ok(text.includes('123456789012'));
});
test('RDAP mapping keeps registrars distinct and does not infer a hidden registrant', () => {
  const raw = {
    entities: [
      { roles: ['registrar'], vcardArray: ['vcard', [['fn', {}, 'text', 'Example Registrar']]] },
      { roles: ['registrant'], vcardArray: ['vcard', [['fn', {}, 'text', 'Private Person']]] },
    ],
    events: [{ eventAction: 'registration', eventDate: '2020-01-01' }],
  };
  const obs = rdapObservations(raw);
  assert.ok(obs.some((o) => o.kind === 'registrar'));
  assert.ok(!obs.some((o) => o.kind === 'registrant_organization'));
  assert.ok(!JSON.stringify(obs).includes('Private Person'));
});
test('contact page crawl follows only published same-origin links with explicit limits', () => {
  const html =
    '<a href="/contact">Contacts</a><a href="https://other.example/privacy">Privacy</a><a href="/terms">Terms</a><a href="/privacy">Privacy</a><a href="/about">About</a><a href="/contact?logout=true">Contact</a>';
  assert.deepEqual(contactPageLinks(html, 'https://example.com/'), [
    'https://example.com/contact',
    'https://example.com/terms',
    'https://example.com/privacy',
  ]);
});
test('facade persists each source and keeps unavailable providers partial', async () => {
  const facade = new OsintFacade([
    {
      id: 'test',
      version: '1',
      async collect() {
        return {
          status: 'completed',
          summary: { ru: 'Тест', kk: 'Сынақ' },
          artifacts: [
            {
              name: 'response.json',
              mime: 'application/json',
              bytes: Buffer.from('{}'),
              sourceUrl: 'https://example.com/source',
            },
          ],
          observations: [{ artifact: 0, kind: 'registrar', value: 'Example', status: 'observed' }],
        };
      },
    },
    {
      id: 'failed',
      version: '1',
      async collect() {
        throw new Error('secret provider error');
      },
    },
  ]);
  const saved: Evidence[] = [];
  const report = await facade.inspect({ url: 'https://example.com', evidence: [] }, (a) => {
    const e = { ...source(''), id: randomUUID(), sourceUrl: a.sourceUrl };
    saved.push(e);
    return e;
  });
  assert.equal(report.status, 'partial');
  assert.equal(report.observations[0].evidenceId, saved[0].id);
  assert.equal(report.observations[0].sourceUrl, 'https://example.com/source');
  assert.ok(!JSON.stringify(report).includes('secret'));
});
test('file-only intake extracts contacts without guessing a domain or invoking DNS', async () => {
  const facade = new OsintFacade([
    {
      id: 'unexpected',
      version: '1',
      async collect() {
        throw Error('must not run');
      },
    },
  ]);
  const report = await facade.inspect({ evidence: [source('Email: office@example.com')] }, () => {
    throw Error('must not save');
  });
  assert.equal(report.observations.length, 1);
  assert.equal(report.hostname, undefined);
  assert.equal(report.stages.find((s) => s.id === 'domain')?.status, 'skipped');
});
test('facade deadline handles collectors that ignore cancellation', async () => {
  const facade = new OsintFacade(
    [{ id: 'slow', version: '1', collect: () => new Promise(() => {}) }],
    15,
  );
  const report = await facade.inspect({ url: 'https://example.com', evidence: [] }, () => {
    throw Error('unexpected');
  });
  assert.equal(report.status, 'partial');
  assert.equal(report.stages[1].status, 'failed');
});

test('detective separates certificate names, links and IPs, excludes wildcards and unsafe names', async () => {
  const { discoverRelations } = await import('../server/osint/detective.ts');
  const report = await new OsintFacade([]).inspect(
    { url: 'https://example.com', evidence: [] },
    () => {
      throw Error('unexpected');
    },
  );
  report.observations.push({
    id: 'tls',
    kind: 'tls_names',
    value: 'DNS:example.com, DNS:mirror.example.net, DNS:*.example.com, DNS:127.0.0.1',
    evidenceId: 'cert',
    status: 'observed',
    collector: 'fixture',
    collectedAt: 'now',
  });
  const html = {
    ...source(
      '<a href="https://news.example.org/story">News</a><a href="http://127.0.0.1">Local</a>',
    ),
    mime: 'text/html',
    sourceUrl: 'https://example.com',
  };
  const relations = discoverRelations(report, [html]);
  assert.deepEqual(
    relations.map((r) => [r.to, r.kind]),
    [
      ['mirror.example.net', 'certificate_contains'],
      ['news.example.org', 'links_to'],
    ],
  );
  assert.ok(relations.every((r) => r.status === 'observed' && r.evidenceIds.length));
});
test('detective enforces candidate budget and keeps shared IP as infrastructure, never ownership', async () => {
  const { DetectiveService } = await import('../server/osint/detective.ts');
  const report = await new OsintFacade([]).inspect(
    { url: 'https://example.com', evidence: [] },
    () => {
      throw Error('unexpected');
    },
  );
  report.observations.push({
    id: 'tls',
    kind: 'tls_names',
    value: 'DNS:a.example.net, DNS:b.example.net',
    evidenceId: 'cert',
    status: 'observed',
    collector: 'fixture',
    collectedAt: 'now',
  });
  let calls = 0;
  const detective = new DetectiveService(
    {
      id: 'dns',
      version: 'test',
      async collect() {
        calls++;
        return {
          status: 'completed',
          summary: { ru: '', kk: '' },
          artifacts: [{ name: 'dns.json', mime: 'application/json', bytes: Buffer.from('{}') }],
          observations: [
            { artifact: 0, kind: 'dns_A', value: '["203.0.113.1"]', status: 'observed' },
          ],
        };
      },
    },
    1,
  );
  await detective.investigate(report, [], () => ({ ...source(''), id: 'dns-source' }));
  assert.equal(calls, 1);
  assert.deepEqual(
    report.candidates?.map((c) => c.status),
    ['dns_checked', 'not_checked'],
  );
  assert.ok(
    report.relations?.some((r) => r.kind === 'resolves_to' && r.evidenceIds.includes('dns-source')),
  );
  assert.equal(report.status, 'partial');
});
test('detective deadline terminates a DNS provider that ignores cancellation', async () => {
  const { DetectiveService } = await import('../server/osint/detective.ts');
  const report = await new OsintFacade([]).inspect(
    { url: 'https://example.com', evidence: [] },
    () => {
      throw Error('unexpected');
    },
  );
  report.observations.push({
    id: 'tls',
    kind: 'tls_names',
    value: 'DNS:a.example.net',
    evidenceId: 'cert',
    status: 'observed',
    collector: 'fixture',
    collectedAt: 'now',
  });
  await new DetectiveService(
    { id: 'slow', version: '1', collect: () => new Promise(() => {}) },
    5,
    15,
  ).investigate(report, [], () => {
    throw Error('unexpected');
  });
  assert.equal(report.candidates?.[0].status, 'unavailable');
});

test('official registry adapter matches only exact domain or labelled BIN, never fuzzy identity', async () => {
  const { registryMatches } = await import('../server/osint/official.ts');
  const report = await new OsintFacade([]).inspect(
    { url: 'https://example.com', evidence: [] },
    () => {
      throw Error('unexpected');
    },
  );
  const rows = [
    {
      row: 4,
      bin: '123456789012',
      organization: 'Example',
      license: '123',
      website: 'https://www.example.com',
    },
    {
      row: 5,
      bin: '234567890123',
      organization: 'Example',
      license: '124',
      website: 'https://example.com.evil.org',
    },
  ];
  assert.deepEqual(
    registryMatches(rows, report).map((r) => r.row),
    [4],
  );
});
test('official source parser rejects wrong law, preserves article identifiers and text', async () => {
  const { parseLaw } = await import('../server/osint/official.ts');
  assert.throws(() => parseLaw('<p>Статья 6. Fake law</p>'), /LAW_IDENTITY/);
  const title = 'Закон Республики Казахстан от 12 января 2007 года № 219';
  const articles = ['1', '6', '9', '10']
    .map((a) => '<p>Статья ' + a + '. ' + 'Тестовый текст. '.repeat(6) + '</p>')
    .join('');
  assert.deepEqual(
    parseLaw(title + articles).map((n) => n.article),
    ['1', '6', '9'],
  );
});
test('official source outages retain previous observations and never report absent license', async () => {
  const { OfficialSourcesService } = await import('../server/osint/official.ts');
  const report = await new OsintFacade([]).inspect(
    { evidence: [source('Email: office@example.com')] },
    () => {
      throw Error('unexpected');
    },
  );
  await new OfficialSourcesService(async () => {
    throw Error('outage');
  }).enrich(report, () => {
    throw Error('unexpected');
  });
  assert.equal(report.observations.length, 1);
  assert.equal(report.registry, undefined);
  assert.equal(report.stages.filter((s) => s.status === 'failed').length, 1);
});
