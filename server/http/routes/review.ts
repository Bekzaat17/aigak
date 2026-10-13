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
  router.patch('/api/cases/:id/findings/:findingId', (req, res) =>
    res.json(reviewFindingCommand(store, req.params, req.body)),
  );
  router.patch('/api/cases/:id/clarifications/:questionId', (req, res) =>
    res.json(answerClarificationCommand(store, req.params, req.body)),
  );
  router.patch('/api/cases/:id/questions/:questionId', (req, res) =>
    res.json(answerQuestionCommand(store, req.params, req.body)),
  );
  router.patch('/api/cases/:id/relations/:relationId', (req, res) =>
    res.json(reviewRelationCommand(store, req.params, req.body)),
  );
  router.patch('/api/cases/:id/findings/:findingId/region', (req, res) =>
    res.json(setFindingRegionCommand(store, req.params, req.body)),
  );
  router.patch('/api/cases/:id/template', (req, res) =>
    res.json(selectTemplateCommand(store, req.params, req.body, templates)),
  );
  router.patch('/api/cases/:id/legal-review', (req, res) =>
    res.json(saveLegalReviewCommand(store, req.params, req.body)),
  );
  router.post('/api/cases/:id/review', (req, res) =>
    res.json(approveCaseCommand(store, req.params, req.body)),
  );
  return router;
}
