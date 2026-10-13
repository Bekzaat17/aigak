import { Router } from 'express';
import { addMaterials } from '../../application/intake/addMaterials.ts';
import { createDemo } from '../../application/intake/createDemo.ts';
import { reanalyzeCase } from '../../application/intake/reanalyzeCase.ts';
import { submitCase } from '../../application/intake/submitCase.ts';
import type { HttpDependencies } from '../contracts.ts';
import { uploadName } from '../upload-name.ts';
export function casesRoutes(
  dependencies: Pick<HttpDependencies, 'store' | 'queue' | 'templates' | 'upload'>,
) {
  const { store, upload } = dependencies;
  const router = Router();
  router.get('/api/cases', (_req, res) => res.json(store.list()));
  router.post('/api/cases', upload.array('files', 5), (req, res) => {
    const files = ((req.files || []) as Express.Multer.File[]).map((file) => ({
      name: uploadName(file.originalname),
      buffer: file.buffer,
    }));
    res.status(201).json(submitCase(dependencies, req.body, files));
  });
  router.post('/api/demo', (req, res) => {
    const result = createDemo(dependencies);
    res.status(result.created ? 201 : 200).json(result.record);
  });
  router.get('/api/cases/:id', (req, res) => {
    const c = store.get(req.params.id);
    if (!c) return void res.status(404).json({ error: 'NOT_FOUND' });
    res.json(c);
  });
  router.post('/api/cases/:id/materials', upload.array('files', 5), (req, res) => {
    const files = ((req.files || []) as Express.Multer.File[]).map((file) => ({
      name: uploadName(file.originalname),
      buffer: file.buffer,
    }));
    res.status(200).json(addMaterials(dependencies, String(req.params.id), req.body.text, files));
  });
  router.post('/api/cases/:id/reanalyze', (req, res) => {
    res.status(202).json(reanalyzeCase(dependencies, req.params.id, req.body));
  });
  return router;
}
