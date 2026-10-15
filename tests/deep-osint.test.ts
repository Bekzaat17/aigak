import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  kaznicObservations,
  KaznicWhoisCollector,
} from '../server/osint/collectors/KaznicWhoisCollector';
import {
  archiveSnapshot,
  ArchiveHistoryCollector,
} from '../server/osint/collectors/ArchiveHistoryCollector';
import { domainTarget } from '../server/osint/domain';
import { OsintFacade } from '../server/osint/OsintFacade';
import { socialProfiles, relatedSites } from '../src/features/resource-graph/resource-sections';
import type { CaseRecord, Evidence } from '../shared/types';
const response = (body: string) => ({
  status: 200,
  headers: {},
  url: 'https://www.nic.kz/en/whois?query=example.kz',
  redirects: [],
  body: Buffer.from(body),
});
const whois =
  'Domain Name............: example.kz\nRegistrant\nOrganization Name......: Example LLC\nAdministrative Contact\nOrganization Name......: Not the owner\nDomain created.........: 2014-11-09 19:11:43 (GMT+0:00)\nCurrent Registrar......: Registrar';
test('WHOIS pins identity, selects registrant organization rather than administrative contact, honors privacy', () => {
  const o = kaznicObservations(whois, 'example.kz');
  assert.equal(o.find((o) => o.kind === 'registrant_organization')?.value, 'Example LLC');
  assert.equal(o.find((o) => o.kind === 'registration')?.value, '2014-11-09T19:11:43Z');
  assert.throws(() => kaznicObservations(whois, 'other.kz'), /DOMAIN_MISMATCH/);
  const hidden = kaznicObservations(
    whois.replace('Example LLC', '[REDACTED FOR PRIVACY]'),
    'example.kz',
  );
  assert.ok(!hidden.some((o) => o.kind === 'registrant_organization'));
  assert.ok(hidden.some((o) => o.kind === 'registrant_privacy'));
});
const archived = (url = 'http://web.archive.org/web/20230101000000/https://example.kz/') => ({
  archived_snapshots: {
    closest: { available: true, status: '200', timestamp: '20230101000000', url },
  },
});
test('archive checks provider, timestamp and original domain; never treats nearby date as requested date', () => {
  assert.equal(archiveSnapshot(archived(), 'example.kz')?.date, '2023-01-01');
  assert.throws(
    () =>
      archiveSnapshot(
        archived('https://evil.test/web/20230101000000/https://example.kz/'),
        'example.kz',
      ),
    /SOURCE/,
  );
  assert.throws(
    () =>
      archiveSnapshot(
        archived('https://web.archive.org/web/20230101000000/https://other.kz/'),
        'example.kz',
      ),
    /DOMAIN/,
  );
  assert.equal(archiveSnapshot({ archived_snapshots: {} }, 'example.kz'), undefined);
});
test('registered collectors preserve provenance, partial archive responses and independent WHOIS results', async () => {
  let requests = 0;
  const collectors = [
    new KaznicWhoisCollector(async () => response('<pre>' + whois + '</pre>')),
    new ArchiveHistoryCollector(
      async () => {
        if (requests++ === 0) throw Error('timeout');
        return response(JSON.stringify(archived()));
      },
      () => 2026,
    ),
  ];
  let n = 0;
  const r = await new OsintFacade(collectors).inspect(
    { url: 'https://example.kz', evidence: [] },
    (a) => ({ id: String(++n), sourceUrl: a.sourceUrl, createdAt: '2026-10-15' }) as Evidence,
  );
  assert.equal(r.observations.filter((o) => o.kind === 'archive_snapshot').length, 1);
  assert.ok(r.observations.every((o) => o.evidenceId && o.sourceUrl));
  assert.equal(r.stages.find((s) => s.id === 'archive-history')?.status, 'partial');
  const abort = new AbortController();
  abort.abort();
  await assert.rejects(
    new OsintFacade(collectors).inspect(
      { url: 'https://example.kz', evidence: [] },
      () => {
        throw Error('must not save');
      },
      abort.signal,
    ),
  );
  assert.equal(
    (await collectors[0].collect(domainTarget('https://example.org'), new AbortController().signal))
      .status,
    'skipped',
  );
});
test('social channels and domain relations are separate; arbitrary links and certificate names are not mirrors', () => {
  const c = {
    sourceUrl: 'https://example.kz',
    links: ['https://t.me/operator', 'https://apps.example.kz/', 'https://unrelated.org'],
    osint: {
      observations: [],
      relations: [
        {
          kind: 'similar_content',
          to: 'copy.example.org',
          description: '90%',
          evidenceIds: ['a', 'b'],
        },
        { kind: 'certificate_contains', to: 'unproven.org', evidenceIds: ['c'] },
      ],
    },
  } as unknown as CaseRecord;
  assert.deepEqual(
    socialProfiles(c).map((p) => p.url),
    ['https://t.me/operator'],
  );
  assert.deepEqual(
    relatedSites(c).map((p) => p.url),
    ['https://apps.example.kz/', 'https://copy.example.org/'],
  );
});
