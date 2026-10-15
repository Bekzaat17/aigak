import { Router } from 'express';
import { z } from 'zod';
import type { HttpDependencies } from '../contracts';
export function authChallengeRoutes({
  authChallenges,
  store,
}: Pick<HttpDependencies, 'authChallenges' | 'store'>) {
  const router = Router();
  router.get('/api/cases/:id/auth-challenge', async (req, res) => {
    const id = z.string().uuid().parse(req.params.id);
    if (!(await store.get(id))) return void res.status(404).json({ error: 'NOT_FOUND' });
    res.json({ challenge: authChallenges?.get(id) || null });
  });
  router.post('/api/cases/:id/auth-challenge', async (req, res) => {
    const id = z.string().uuid().parse(req.params.id);
    const { challengeId, code } = z
      .object({ challengeId: z.string().uuid(), code: z.string().regex(/^\d{4,10}$/) })
      .strict()
      .parse(req.body);
    const c = await store.get(id);
    if (!c || !authChallenges || c.status !== 'collecting')
      return void res.status(409).json({ error: 'CHALLENGE_EXPIRED' });
    authChallenges.submit(id, challengeId, code);
    res.json({ ok: true });
  });
  return router;
}
