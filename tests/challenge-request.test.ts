import assert from 'node:assert/strict';
import { test } from 'node:test';
import { isChallengeRequest } from '../server/collection/browser/challenge-request';
import { pageTextQuality } from '../shared/collection';

test('verification POST exception is limited to official transport, origin and payload size', () => {
  const page = 'https://sz.kz/mega-casino';
  for (const target of [
    'https://sz.kz/cdn-cgi/challenge-platform/h/g/flow',
    'https://challenges.cloudflare.com/cdn-cgi/challenge-platform/h/g/flow',
  ]) {
    assert.equal(isChallengeRequest(new URL(target), page, 100), true);
    assert.equal(isChallengeRequest(new URL(target), page, 262145), false);
  }
  for (const target of [
    'https://sz.kz/register',
    'https://sz.kz/deposit',
    'https://evil.example/cdn-cgi/challenge-platform/a',
    'https://challenges.cloudflare.com.evil.example/cdn-cgi/challenge-platform/a',
    'http://sz.kz/cdn-cgi/challenge-platform/a',
    'https://sz.kz:8443/cdn-cgi/challenge-platform/a',
  ]) {
    assert.equal(isChallengeRequest(new URL(target), page, 10), false);
  }
  assert.equal(
    isChallengeRequest(new URL('https://sz.kz/cdn-cgi/challenge-platform/a'), 'about:blank', 0),
    false,
  );
});
test('Russian Cloudflare page with a domain prefix is not adequate evidence', () => {
  assert.equal(
    pageTextQuality(
      'sz.kz\nВыполнение проверки безопасности\nЭтот веб-сайт использует сервис безопасности для защиты от вредоносных ботов. Эта страница отображается, пока веб-сайт проверяет, что вы не бот. Ray ID: 123. Производительность и безопасность с Cloudflare. Конфиденциальность. Подтвердите, что вы человек.',
    ),
    'limited',
  );
});

test('Kazakhstan legal prompt distinguishes lotteries, privacy uncertainty and foreign cookie rules', async () => {
  const { legal } = await import('../server/ai/prompts/legal');
  const { legalCatalog } = await import('../server/osint/LegalCorpusService');
  assert.match(legal, /lottery/);
  assert.match(legal, /Cookies alone/);
  assert.match(legal, /Do not import GDPR/);
  assert.match(legal, /lawful inspector next steps/);
  assert.ok(legalCatalog.some((s) => s.id === 'Z1600000495'));
  assert.ok(legalCatalog.some((s) => s.id === 'Z1300000094'));
});

test('an explicit CAPTCHA failure overrides apparent text adequacy including OCR', async () => {
  const { reviewCollectionAttempt } = await import('../server/domain/review-collection-attempt');
  const evidence = {
    kind: 'text',
    text: 'Apparently readable words from OCR on a challenge page. '.repeat(20),
  } as import('../shared/types').Evidence;
  assert.equal(reviewCollectionAttempt([evidence], 'CAPTCHA_REQUIRED').status, 'failed');
});
