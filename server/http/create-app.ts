import express from 'express';
import type { HttpDependencies } from './contracts.ts';
import { errorHandler } from './middleware/error-handler.ts';
import { localAccess } from './middleware/local-access.ts';
import { casesRoutes } from './routes/cases.ts';
import { documentsRoutes } from './routes/documents.ts';
import { reviewRoutes } from './routes/review.ts';
import { systemRoutes } from './routes/system.ts';
import { templatesRoutes } from './routes/templates.ts';

/** No listener, database or background jobs are created by the HTTP adapter. */
export function createApp(dependencies: HttpDependencies, port: number) {
  const app = express();
  app.disable('x-powered-by');
  app.use(localAccess(port));
  app.use(express.json({ limit: '300kb' }));
  for (const routes of [systemRoutes, templatesRoutes, casesRoutes, reviewRoutes, documentsRoutes])
    app.use(routes(dependencies));
  app.use('/api', (_req, res) => res.status(404).json({ error: 'NOT_FOUND' }));
  app.use(errorHandler);
  return app;
}
