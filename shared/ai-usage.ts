import type { AiAttempt } from './types.ts';

/** Missing provider usage is never treated as a measured zero. Includes failed retries. */
export function summarizeAiUsage(attempts: AiAttempt[], expectedAttempts = attempts.length) {
  const unrecorded = Math.max(0, expectedAttempts - attempts.length);
  return {
    inputTokens: attempts.reduce((sum, attempt) => sum + (attempt.inputTokens ?? 0), 0),
    outputTokens: attempts.reduce((sum, attempt) => sum + (attempt.outputTokens ?? 0), 0),
    missingInput:
      unrecorded + attempts.filter((attempt) => attempt.inputTokens === undefined).length,
    missingOutput:
      unrecorded + attempts.filter((attempt) => attempt.outputTokens === undefined).length,
    missingUsageAttempts:
      unrecorded +
      attempts.filter(
        (attempt) => attempt.inputTokens === undefined || attempt.outputTokens === undefined,
      ).length,
  };
}
