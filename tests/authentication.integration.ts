import assert from 'node:assert/strict';
import { test } from 'node:test';
import { chromium } from 'playwright';
import { BrowserAuthenticationAgent } from '../server/auth/BrowserAuthenticationAgent';
import { sanitizedDom } from '../server/auth/sanitized-dom';
import type { AuthProfile } from '../server/auth/contracts';

const profile: AuthProfile = {
  id: 'fixture',
  name: 'Fixture',
  origin: 'https://account.example.com',
  registration: true,
  login: {
    url: 'https://account.example.com/login',
    fields: { '#email': 'qa@fixture.example', '#password': 'test-secret' },
    submitSelector: '#submit',
    submitUrls: ['https://account.example.com/login'],
  },
  register: {
    url: 'https://account.example.com/register',
    fields: { '#email': 'qa@fixture.example', '#password': 'test-secret' },
    submitSelector: '#submit',
    submitUrls: ['https://account.example.com/register'],
  },
  successSelector: '[data-authenticated]',
  readUrls: ['https://account.example.com/account'],
  verification: {
    endpoint: 'https://inbox.example.com/link',
    token: 'test-token',
    allowedPathPrefix: '/verify/',
  },
};
for (const mode of ['login', 'register'] as const)
  test(
    'browser agent ' + mode + ' confirms authenticated pages; registration uses a test inbox',
    async () => {
      const browser = await chromium.launch({ channel: process.env.BROWSER_CHANNEL || 'chrome' });
      try {
        const page = await browser.newPage();
        let authenticated = false;
        let registered = false;
        let submissions = 0;
        let mailReads = 0;
        await page.route('**/*', async (route) => {
          const r = route.request();
          const u = new URL(r.url());
          if (r.method() === 'POST') {
            const body = new URLSearchParams(r.postData() || '');
            assert.equal(body.get('email'), 'qa@fixture.example');
            assert.equal(body.get('password'), 'test-secret');
            submissions++;
            registered = mode === 'register';
            authenticated = mode === 'login';
            await route.fulfill({ status: 302, headers: { location: '/account' } });
            return;
          }
          if (u.pathname === '/verify/fixture') authenticated = registered;
          if (u.pathname === '/login' || u.pathname === '/register') {
            await route.fulfill({
              contentType: 'text/html',
              body: `<form method="post"><input id="email" name="email"><input id="password" name="password" type="password"><button id="submit">Submit</button></form>`,
            });
            return;
          }
          await route.fulfill({
            contentType: 'text/html',
            body: authenticated
              ? '<body><div data-authenticated="true">Account</div><p>Internal game rules and deposit information</p><input type="hidden" value="csrf-secret"><script>const token="session-secret"</script></body>'
              : '<body>Please confirm your email</body>',
          });
        });
        const agent = new BrowserAuthenticationAgent({
          waitForLink: async () => {
            mailReads++;
            assert.ok(registered);
            return 'https://account.example.com/verify/fixture';
          },
        });
        assert.equal(
          await agent.authenticate(page, profile, mode, AbortSignal.timeout(30000)),
          true,
        );
        assert.equal(submissions, 1);
        assert.equal(mailReads, mode === 'register' ? 1 : 0);
        const html = await sanitizedDom(page);
        assert.ok(html.includes('Internal game rules'));
        assert.ok(!html.includes('csrf-secret'));
        assert.ok(!html.includes('session-secret'));
        assert.ok(!html.includes('test-secret'));
      } finally {
        await browser.close();
      }
    },
  );
test('registration rejects a mailbox link to a different origin', async () => {
  const browser = await chromium.launch({ channel: process.env.BROWSER_CHANNEL || 'chrome' });
  try {
    const page = await browser.newPage();
    await page.route('**/*', (route) =>
      route.fulfill({
        contentType: 'text/html',
        body: '<input id="email"><input id="password"><button id="submit">Register</button>',
      }),
    );
    const agent = new BrowserAuthenticationAgent({
      waitForLink: async () => 'https://evil.example/verify/token',
    });
    await assert.rejects(
      agent.authenticate(page, profile, 'register', AbortSignal.timeout(30000)),
      /VERIFICATION_LINK_REJECTED/,
    );
  } finally {
    await browser.close();
  }
});

test('private finding never receives a proof screenshot after session expiration', async () => {
  const { BrowserFindingVerifier } = await import('../server/collection/BrowserFindingVerifier');
  const browser = await chromium.launch({ channel: process.env.BROWSER_CHANNEL || 'chrome' });
  try {
    const context = await browser.newContext();
    await context.route('**/*', (route) =>
      route.fulfill({
        contentType: 'text/html',
        body: '<body><p>Casino bonus</p><p>' + 'Public page text '.repeat(60) + '</p></body>',
      }),
    );
    const record = {
      sourceType: 'url',
      evidence: [
        {
          id: 'private',
          access: 'authenticated',
          sourceUrl: 'https://account.example.com/account',
        },
      ],
      findings: [{ id: 'finding', evidenceId: 'private', quote: 'Casino bonus' }],
    } as unknown as import('../shared/types').CaseRecord;
    let saved = 0;
    await new BrowserFindingVerifier(
      {
        addEvidence: async () => {
          saved++;
          throw Error('Unexpected evidence');
        },
      },
      async () => ({ context, close: async () => {} }),
      async () => false,
    ).verify(record);
    assert.equal(saved, 0);
    const proof = record.findings[0].visualEvidence;
    assert.ok(proof?.status === 'unavailable');
    assert.equal(proof.reason, 'AUTH_NOT_CONFIRMED');
  } finally {
    await browser.close();
  }
});
