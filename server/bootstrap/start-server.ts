import { FileAuthChallenges } from '../auth/FileAuthChallenges';
import { parseAuthProfiles, publicAuthProfiles } from '../auth/auth-profiles';
import { StandardReportLayout } from '../package/adapters/StandardReportLayout.ts';
import express from 'express';
import { InterruptedIntakeRecovery } from '../application/processing/InterruptedIntakeRecovery.ts';
import multer from 'multer';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { CaseDocumentService } from '../application/CaseDocumentService.ts';
import { browserOptions } from '../collector.ts';
import { createApp } from '../http/create-app.ts';
import { createAiAnalyzer } from '../inspection/provider.ts';
import { DocxRenderer } from '../package/adapters/DocxRenderer.ts';
import { createPackageService } from '../package/index.ts';
import { createPostgresStorage } from './create-postgres-storage.ts';
import { createProcessing } from './create-processing.ts';

export async function startServer() {
  const root = fileURLToPath(new URL('../../', import.meta.url));
  const port = Number(process.env.PORT || 4317);
  const dataDirectory = path.resolve(process.env.DATA_DIR || path.join(root, 'data'));
  const driver = process.env.STORAGE_DRIVER || 'postgres';
  if (driver !== 'postgres' && driver !== 'sqlite') throw new Error('INVALID_STORAGE_DRIVER');
  if (driver === 'postgres' && !process.env.DATABASE_URL) throw new Error('DATABASE_URL_REQUIRED');
  const storage =
    driver === 'sqlite'
      ? {
          ...(await import('./create-local-storage.ts')).createLocalStorage(dataDirectory),
          jobs: undefined,
        }
      : await createPostgresStorage(dataDirectory, process.env.DATABASE_URL!);
  try {
    const { store, templates } = storage;
    if (storage.jobs)
      await new InterruptedIntakeRecovery(store).recover(await storage.jobs.interruptedIntakes());
    const authProfiles = publicAuthProfiles(parseAuthProfiles(process.env.AIGAK_AUTH_PROFILES));
    if (process.env.OPENAI_API_KEY)
      authProfiles.unshift({
        id: 'automatic',
        name: 'Агент · регистрация с временной почтой',
        origin: '*',
        registration: true,
      });
    const aiAnalyzer = createAiAnalyzer();
    const queue = storage.jobs
      ? storage.jobs
      : (await createProcessing(store, dataDirectory, aiAnalyzer)).queue;
    const documents = new CaseDocumentService(
      store,
      templates,
      new DocxRenderer(),
      createPackageService(browserOptions()),
      new StandardReportLayout(),
    );
    const app = createApp(
      {
        store,
        queue,
        aiAnalyzer,
        authProfiles: { list: () => authProfiles },
        authChallenges: new FileAuthChallenges(dataDirectory),
        templates,
        documents,
        upload: multer({
          storage: multer.memoryStorage(),
          limits: { files: 5, fileSize: 10 * 1024 * 1024, fields: 10, fieldSize: 200000 },
        }),
      },
      port,
    );
    let closeAssets = async () => {};
    if (process.env.NODE_ENV === 'production') {
      app.use(express.static(path.join(root, 'dist')));
      app.get('/{*path}', (_req, res) => res.sendFile(path.join(root, 'dist', 'index.html')));
    } else {
      const { createServer } = await import('vite');
      const vite = await createServer({ server: { middlewareMode: true }, appType: 'spa' });
      app.use(vite.middlewares);
      closeAssets = () => vite.close();
    }
    const server = app.listen(port, process.env.HOST || '127.0.0.1', () =>
      console.log(`aigak ready: http://localhost:${port}`),
    );
    const shutdown = () => server.close();
    process.once('SIGTERM', shutdown);
    process.once('SIGINT', shutdown);
    let closing: Promise<void> | undefined;
    const cleanup = () => {
      process.off('SIGTERM', shutdown);
      process.off('SIGINT', shutdown);
      closing ??= (async () => {
        try {
          if ('whenIdle' in queue) await queue.whenIdle();
          await closeAssets();
        } finally {
          await storage.close();
        }
      })();
      void closing.catch(() => console.error('STORAGE_CLOSE_FAILED'));
    };
    server.once('close', cleanup);
    server.once('error', cleanup);
    return server;
  } catch (error) {
    await storage.close();
    throw error;
  }
}
