import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { setTimeout, clearTimeout } from 'node:timers';
import { chromium } from 'playwright';

const directory = mkdtempSync(path.join(tmpdir(), 'aigak-ui-smoke-'));
const port = process.env.SMOKE_PORT || '4329';
const origin = `http://localhost:${port}`;
const server = spawn(process.execPath, ['--import', 'tsx', 'server/index.ts'], {
  env: {
    ...process.env,
    NODE_ENV: 'production',
    PORT: port,
    DATA_DIR: directory,
    OPENAI_API_KEY: '',
  },
  stdio: ['ignore', 'pipe', 'pipe'],
});
const exited = once(server, 'exit');
let browser;
let serverOutput = '';
server.stderr.on('data', (bytes) => {
  serverOutput += bytes.toString();
});
try {
  await new Promise((resolve, reject) => {
    const timer = setTimeout(
      () => reject(new Error(`Server startup timeout: ${serverOutput}`)),
      15000,
    );
    server.stdout.on('data', (bytes) => {
      if (bytes.toString().includes('aigak ready')) {
        clearTimeout(timer);
        resolve();
      }
    });
    server.once('error', (error) => {
      clearTimeout(timer);
      reject(error);
    });
    server.once('exit', (code) => {
      clearTimeout(timer);
      reject(new Error(`Server exited ${code}: ${serverOutput}`));
    });
  });
  browser = await chromium.launch({
    channel: process.env.SMOKE_BROWSER || 'chrome',
    headless: true,
  });
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
  page.setDefaultTimeout(15000);
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('response', (response) => {
    if (response.status() >= 500) errors.push(`${response.status()} ${response.url()}`);
  });
  await page.route('**/*', (route) =>
    new URL(route.request().url()).origin === origin ? route.continue() : route.abort(),
  );
  await page.goto(origin);
  await page.getByRole('tab', { name: 'Текст', exact: true }).click();
  await page
    .getByRole('textbox', { name: 'Текст материала', exact: true })
    .fill('Черновик синтетического текста');
  await page.getByRole('tab', { name: 'Файл или скриншот', exact: true }).click();
  await page.locator('.input-area input[type=file]').setInputFiles({
    name: 'sample.txt',
    mimeType: 'text/plain',
    buffer: Buffer.from('Synthetic source'),
  });
  await page.getByRole('button', { name: 'Удалить файл', exact: true }).click();
  assert.equal(
    await page.getByRole('button', { name: 'Анализировать', exact: false }).isDisabled(),
    true,
  );
  await page.getByRole('tab', { name: 'Текст', exact: true }).click();
  assert.equal(
    await page.getByRole('textbox', { name: 'Текст материала', exact: true }).inputValue(),
    'Черновик синтетического текста',
  );
  await page.getByRole('button', { name: 'Управление шаблонами', exact: true }).click();
  await page.getByRole('dialog', { name: 'Шаблоны', exact: true }).waitFor();
  await page.keyboard.press('Escape');
  await page.getByRole('button', { name: 'Как это работает', exact: false }).click();
  await page.getByRole('heading', { name: 'От материала до пакета', exact: true }).waitFor();
  await page.keyboard.press('Escape');
  await page.getByRole('button', { name: 'Открыть пример', exact: false }).click();
  await page.locator('.finding-index button').first().waitFor();
  assert.ok((await page.locator('.finding-index button').count()) > 0);
  const accepted = page.getByRole('button', { name: 'Подтвердить', exact: true });
  await accepted.click();
  await page.locator('.decision-options button:first-child[aria-pressed="true"]').waitFor();
  await page.getByRole('button', { name: 'Проверка и пакет', exact: true }).click();
  await page.locator('.review-form').waitFor();
  await page.getByRole('button', { name: 'Предпросмотр стандартного отчёта', exact: true }).click();
  await page.locator('iframe').waitFor();
  await page.frameLocator('iframe').locator('body').waitFor();
  assert.ok((await page.frameLocator('iframe').locator('body').innerText()).length > 100);
  await page.getByRole('button', { name: 'ҚАЗ', exact: true }).click();
  assert.equal(
    await page.getByRole('button', { name: 'ҚАЗ', exact: true }).getAttribute('aria-pressed'),
    'true',
  );
  await page.getByRole('button', { name: /Тарих/ }).click();
  await page.getByRole('dialog', { name: 'Тарих', exact: true }).waitFor();
  await page.keyboard.press('Escape');
  await page.getByRole('dialog').waitFor({ state: 'hidden' });
  await page.getByRole('button', { name: 'RU', exact: true }).click();
  await page.getByText('Добавить материалы', { exact: true }).click();
  await page
    .getByRole('textbox', { name: 'Дополнительный текст', exact: true })
    .fill('Синтетический материал для проверки сохранения.');
  const materialResponse = page.waitForResponse(
    (response) => response.url().endsWith('/materials') && response.request().method() === 'POST',
  );
  await page.getByRole('button', { name: 'Сохранить материалы', exact: true }).click();
  const response = await materialResponse;
  assert.equal(response.status(), 200);
  assert.equal((await response.json()).materialsPending, true);
  await page
    .getByText('Новые материалы ещё не проверены. Запустите повторный анализ.', { exact: true })
    .waitFor();
  await page.setViewportSize({ width: 390, height: 844 });
  assert.ok(
    await page.locator('html').evaluate((element) => element.scrollWidth <= element.clientWidth),
  );
  await page.getByRole('button', { name: /История/ }).click();
  await page.locator('.history-list button').first().click();
  await page.getByRole('dialog').waitFor({ state: 'hidden' });
  // Hold a mutation response while switching cases: it must not restore the old case.
  await page.setViewportSize({ width: 1440, height: 1000 });
  const created = await page.request.post(`${origin}/api/cases`, {
    headers: { 'X-Aigak-Client': 'local' },
    multipart: {
      title: 'UI isolation test',
      sourceType: 'text',
      text: 'Синтетический материал.',
      analysisLevel: 'basic',
      useAi: 'false',
    },
  });
  assert.equal(created.status(), 201);
  let releaseMutation;
  let markHeld;
  const held = new Promise((resolve) => {
    markHeld = resolve;
  });
  const release = new Promise((resolve) => {
    releaseMutation = resolve;
  });
  await page.route('**/findings/*', async (route) => {
    const response = await route.fetch();
    markHeld();
    await release;
    await route.fulfill({ response });
  });
  await page.getByRole('button', { name: 'Выводы', exact: false }).click();
  await page.getByRole('button', { name: 'Отклонить', exact: true }).click();
  await held;
  try {
    await page.getByRole('button', { name: /История/ }).click();
    await page.locator('.history-list button').filter({ hasText: 'UI isolation test' }).click();
    await page.getByRole('heading', { name: 'UI isolation test', exact: true }).waitFor();
  } finally {
    releaseMutation();
  }
  await page.waitForLoadState('networkidle');
  assert.equal(await page.locator('.result-heading h1').innerText(), 'UI isolation test');
  assert.deepEqual(errors, []);
  console.log(
    'UI smoke passed: demo, finding decision, package, preview, RU/KK, history/Escape, materials, mobile, delayed mutation isolation.',
  );
} finally {
  await browser?.close();
  if (server.exitCode === null && server.signalCode === null) server.kill('SIGTERM');
  await exited;
  rmSync(directory, { recursive: true, force: true });
}
