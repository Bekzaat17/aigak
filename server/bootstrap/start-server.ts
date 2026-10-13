import express from 'express';
import multer from 'multer';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { CaseDocumentService } from '../application/CaseDocumentService.ts';
import { browserOptions } from '../collector.ts';
import { createApp } from '../http/create-app.ts';
import { createAiAnalyzer } from '../inspection/provider.ts';
import { DocxRenderer } from '../package/adapters/DocxRenderer.ts';
import { createPackageService } from '../package/index.ts';
import { Store } from '../storage/Store.ts';
import { Templates } from '../templates.ts';
import { createProcessing } from './create-processing.ts';

export async function startServer() {
  const root = fileURLToPath(new URL('../../', import.meta.url));
  const port = Number(process.env.PORT || 4317);
  const store = new Store(path.resolve(process.env.DATA_DIR || path.join(root, 'data')));
  const aiAnalyzer = createAiAnalyzer();
  const { queue } = createProcessing(store, aiAnalyzer);
  const templates = new Templates(store);
  const documents = new CaseDocumentService(
    store,
    templates,
    new DocxRenderer(),
    createPackageService(browserOptions()),
  );
  const app = createApp(
    {
      store,
      queue,
      aiAnalyzer,
      templates,
      documents,
      upload: multer({
        storage: multer.memoryStorage(),
        limits: { files: 5, fileSize: 10 * 1024 * 1024, fields: 8, fieldSize: 200000 },
      }),
    },
    port,
  );
  if (process.env.NODE_ENV === 'production') {
    app.use(express.static(path.join(root, 'dist')));
    app.get('/{*path}', (_req, res) => res.sendFile(path.join(root, 'dist', 'index.html')));
  } else {
    const { createServer } = await import('vite');
    const vite = await createServer({ server: { middlewareMode: true }, appType: 'spa' });
    app.use(vite.middlewares);
  }
  return app.listen(port, '127.0.0.1', () => console.log(`aigak ready: http://localhost:${port}`));
}
