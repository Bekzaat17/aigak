import { Router } from 'express';
import { z } from 'zod';
import { busyStatuses } from '../../../shared/types.ts';
import { sha256 } from '../../domain/sha256.ts';
import type { HttpDependencies } from '../contracts.ts';

export function documentsRoutes({
  store,
  documents,
}: Pick<HttpDependencies, 'store' | 'documents'>) {
  const router = Router();
  router.get('/api/cases/:id/preview', async (req, res) => {
    const c = await store.get(req.params.id);
    if (!c) throw Error('NOT_FOUND');
    const lang = z.enum(['ru', 'kk']).default('ru').parse(req.query.lang);
    res.setHeader(
      'Content-Security-Policy',
      "sandbox; default-src 'none'; style-src 'unsafe-inline'; img-src data:",
    );
    res.setHeader('X-Frame-Options', 'SAMEORIGIN');
    res.type('html').send(documents.preview(c, lang));
  });
  router.get('/api/cases/:id/document', async (req, res) => {
    const c = await store.get(req.params.id);
    if (!c) throw Error('NOT_FOUND');
    const lang = z.enum(['ru', 'kk']).default('ru').parse(req.query.lang);
    const bytes = await documents.document(c, lang);
    res
      .type('application/vnd.openxmlformats-officedocument.wordprocessingml.document')
      .attachment(c.number + '-' + lang + '.docx')
      .send(bytes);
  });
  router.post('/api/cases/:id/export', async (req, res) => {
    const c = await store.get(req.params.id);
    if (!c) throw new Error('NOT_FOUND');
    if (busyStatuses.includes(c.status)) throw new Error('CASE_BUSY');
    const data = await documents.archive(c);
    res.setHeader('Content-Type', 'application/zip');
    res.setHeader('Content-Disposition', `attachment; filename="${c.number}.zip"`);
    res.send(data);
  });
  router.get('/api/cases/:id/evidence/:evidenceId', async (req, res) => {
    const c = await store.get(req.params.id);
    const e = c?.evidence.find((e) => e.id === req.params.evidenceId);
    if (!c || !e) throw new Error('NOT_FOUND');
    const data = store.read(c, e);
    if (sha256(data) !== e.sha256) throw new Error('INTEGRITY_FAILED');
    res.setHeader('Content-Security-Policy', "sandbox; default-src 'none'");
    res.setHeader(
      'Content-Type',
      e.mime.startsWith('image/') ? e.mime : 'application/octet-stream',
    );
    res.setHeader(
      'Content-Disposition',
      `${e.mime.startsWith('image/') ? 'inline' : 'attachment'}; filename*=UTF-8''${encodeURIComponent(e.name)}`,
    );
    res.send(data);
  });
  return router;
}
