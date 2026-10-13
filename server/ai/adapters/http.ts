import { AiError, type ModelProfile } from '../contracts.ts';

export type HttpTransport = typeof fetch;

export async function post(
  transport: HttpTransport,
  profile: ModelProfile,
  key: string,
  path: string,
  body: unknown,
  signal: AbortSignal,
) {
  let response: Response;
  try {
    response = await transport(profile.baseUrl.replace(/\/$/, '') + path, {
      method: 'POST',
      redirect: 'error',
      signal,
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + key },
      body: JSON.stringify(body),
    });
  } catch {
    if (signal.aborted) throw new AiError('AI_TIMEOUT', true);
    throw new AiError('AI_NETWORK_ERROR', true);
  }
  if (!response.ok)
    throw new AiError(
      response.status === 429 ? 'AI_RATE_LIMIT' : 'AI_HTTP_ERROR',
      response.status === 429 || response.status >= 500,
    );
  try {
    return await response.json();
  } catch {
    throw new AiError('AI_INVALID_RESPONSE');
  }
}

export function tokens(value: unknown) {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0 ? value : undefined;
}
