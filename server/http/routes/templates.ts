import { Router } from 'express';
import { fields } from '../../templates.ts';
import type { HttpDependencies } from '../contracts.ts';
import { uploadName } from '../upload-name.ts';

export function templatesRoutes({
  templates,
  upload,
}: Pick<HttpDependencies, 'templates' | 'upload'>) {
  const router = Router();
  router.get('/api/templates', (_req, res) => res.json({ templates: templates.list(), fields }));
  router.get('/api/templates/:id', async (req, res) => {
    const data = await templates.raw(req.params.id);
    res.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    );
    res.setHeader('Content-Disposition', 'attachment; filename="aigak-template.docx"');
    res.send(data);
  });
  router.post('/api/templates', upload.single('template'), (req, res) => {
    if (!req.file) throw new Error('EMPTY_INPUT');
    res
      .status(201)
      .json(templates.add(uploadName(req.file.originalname, Infinity), req.file.buffer));
  });
  return router;
}
