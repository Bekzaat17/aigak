import { Router } from 'express';
import { levels } from '../../../shared/inspection.ts';
import type { HttpDependencies } from '../contracts.ts';

export function systemRoutes({ aiAnalyzer }: Pick<HttpDependencies, 'aiAnalyzer'>) {
  const router = Router();
  router.get('/api/analysis-levels', (_req, res) => res.json(levels));
  router.get('/api/health', (_req, res) =>
    res.json({ ok: true, version: '0.2.0', aiConfigured: aiAnalyzer.available, localOnly: true }),
  );
  return router;
}
