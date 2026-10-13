import { setTimeout as delay } from 'node:timers/promises';
import {
  AiError,
  type AiConfiguration,
  type AiTask,
  type AttemptObserver,
  type ModelAdapter,
  type ModelRequest,
  type ModelResponse,
} from './contracts.ts';

/** Provider-independent routing. Only explicitly configured routes can receive materials. */
export class AiGateway {
  constructor(
    private readonly config: AiConfiguration,
    private readonly adapters: Record<string, ModelAdapter>,
    private readonly env: NodeJS.ProcessEnv = process.env,
  ) {}
  get available() {
    return (['context', 'mechanics', 'verification'] as const)
      .map((task) => this.config.routes[task])
      .every((route) => route.some((id) => !!this.env[this.config.profiles[id].apiKeyEnv]));
  }
  async complete<T>(
    task: AiTask,
    request: ModelRequest,
    versions: { promptVersion: string; schemaVersion: string },
    signal: AbortSignal,
    observer: AttemptObserver,
    validate: (text: string) => T,
  ): Promise<T> {
    let last = new AiError('AI_NOT_CONFIGURED');
    const route = this.config.routes[task];
    for (const profileId of route) {
      const profile = this.config.profiles[profileId],
        key = this.env[profile.apiKeyEnv];
      if (!key) continue;
      const adapter = this.adapters[profile.adapter];
      if (!adapter) throw new AiError('AI_ADAPTER_MISSING');
      for (let retry = 0; retry <= profile.retries; retry++) {
        signal.throwIfAborted();
        observer.beforeAttempt();
        const startedAt = new Date().toISOString(),
          start = Date.now();
        const timeout = AbortSignal.timeout(profile.timeoutMs);
        const attemptSignal = AbortSignal.any([signal, timeout]);
        let response: ModelResponse | undefined;
        let error: AiError | undefined;
        let value: T | undefined;
        let abortListener = () => {};
        try {
          response = await Promise.race([
            adapter.complete(profile, key, request, attemptSignal),
            new Promise<never>((_, reject) => {
              abortListener = () =>
                reject(
                  new AiError(signal.aborted ? 'AI_CANCELLED' : 'AI_TIMEOUT', !signal.aborted),
                );
              attemptSignal.addEventListener('abort', abortListener, { once: true });
              if (attemptSignal.aborted) abortListener();
            }),
          ]);
          value = validate(response.text);
        } catch (e) {
          error = signal.aborted
            ? new AiError('AI_CANCELLED')
            : e instanceof AiError
              ? e
              : new AiError('AI_INVALID_RESPONSE');
        } finally {
          attemptSignal.removeEventListener('abort', abortListener);
        }
        observer.onAttempt({
          profile: profileId,
          adapter: profile.adapter,
          requestedModel: profile.model,
          actualModel: response?.actualModel,
          promptVersion: versions.promptVersion,
          schemaVersion: versions.schemaVersion,
          startedAt,
          durationMs: Date.now() - start,
          status: error ? 'failed' : 'completed',
          errorCode: error?.code,
          inputTokens: response?.inputTokens,
          outputTokens: response?.outputTokens,
        });
        if (!error) return value!;
        last = error;
        if (!error.retryable) throw error; // Refusals and invalid evidence never trigger another model.
        if (retry < profile.retries) await delay(250 * (retry + 1), undefined, { signal });
      }
    }
    throw last;
  }
}
