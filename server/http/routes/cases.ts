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
  router.get('/api/cases', async (_req, res) => res.json(await store.list()));
  router.post('/api/cases', upload.array('files', 5), async (req, res) => {
    const files = ((req.files || []) as Express.Multer.File[]).map((file) => ({
      name: uploadName(file.originalname),
      buffer: file.buffer,
    }));
    res.status(201).json(await submitCase(dependencies, req.body, files));
  });
  router.post('/api/demo', async (req, res) => {
    const result = await createDemo(dependencies);
    res.status(result.created ? 201 : 200).json(result.record);
  });
  router.get('/api/cases/:id', async (req, res) => {
    const c = await store.get(req.params.id);
    if (!c) return void res.status(404).json({ error: 'NOT_FOUND' });
    res.json(c);
  });
  router.post('/api/cases/:id/materials', upload.array('files', 5), async (req, res) => {
    const files = ((req.files || []) as Express.Multer.File[]).map((file) => ({
      name: uploadName(file.originalname),
      buffer: file.buffer,
    }));
    res
      .status(200)
      .json(await addMaterials(dependencies, String(req.params.id), req.body.text, files));
  });
  router.post('/api/cases/:id/reanalyze', async (req, res) => {
    res.status(202).json(await reanalyzeCase(dependencies, req.params.id, req.body));
  });
  return router;
}
