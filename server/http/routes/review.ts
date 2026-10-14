import { Router } from 'express';
import { answerClarificationCommand } from '../../application/review/answer-clarification.ts';
import { answerQuestionCommand } from '../../application/review/answer-question.ts';
import { approveCaseCommand } from '../../application/review/approve-case.ts';
import { reviewFindingCommand } from '../../application/review/review-finding.ts';
import { reviewRelationCommand } from '../../application/review/review-relation.ts';
import { saveLegalReviewCommand } from '../../application/review/save-legal-review.ts';
import { selectTemplateCommand } from '../../application/review/select-template.ts';
import { setFindingRegionCommand } from '../../application/review/set-finding-region.ts';
import type { HttpDependencies } from '../contracts.ts';
export function reviewRoutes({ store, templates }: Pick<HttpDependencies, 'store' | 'templates'>) {
  const router = Router();
  router.patch('/api/cases/:id/findings/:findingId', async (req, res) =>
    res.json(await reviewFindingCommand(store, req.params, req.body)),
  );
  router.patch('/api/cases/:id/clarifications/:questionId', async (req, res) =>
    res.json(await answerClarificationCommand(store, req.params, req.body)),
  );
  router.patch('/api/cases/:id/questions/:questionId', async (req, res) =>
    res.json(await answerQuestionCommand(store, req.params, req.body)),
  );
  router.patch('/api/cases/:id/relations/:relationId', async (req, res) =>
    res.json(await reviewRelationCommand(store, req.params, req.body)),
  );
  router.patch('/api/cases/:id/findings/:findingId/region', async (req, res) =>
    res.json(await setFindingRegionCommand(store, req.params, req.body)),
  );
  router.patch('/api/cases/:id/template', async (req, res) =>
    res.json(await selectTemplateCommand(store, req.params, req.body, templates)),
  );
  router.patch('/api/cases/:id/legal-review', async (req, res) =>
    res.json(await saveLegalReviewCommand(store, req.params, req.body)),
  );
  router.post('/api/cases/:id/review', async (req, res) =>
    res.json(await approveCaseCommand(store, req.params, req.body)),
  );
  return router;
}
