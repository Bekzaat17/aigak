import type express from 'express';
import multer from 'multer';
import { z } from 'zod';
export const errorHandler: express.ErrorRequestHandler = (
  error: unknown,
  _req: express.Request,
  res: express.Response,
  _next: express.NextFunction,
) => {
  let code = error instanceof Error ? error.message : 'INTERNAL_ERROR';
  if (error instanceof z.ZodError) code = 'VALIDATION_ERROR';
  if (error instanceof multer.MulterError) code = error.code;
  if (!/^[A-Z_]+$/.test(code)) code = 'REQUEST_FAILED';
  const status =
    code === 'QUEUE_FULL'
      ? 429
      : code === 'NOT_FOUND'
        ? 404
        : code === 'INTEGRITY_FAILED' || code === 'CASE_BUSY' || code === 'CASE_CONFLICT'
          ? 409
          : 400;
  res.status(status).json({ error: code });
};
