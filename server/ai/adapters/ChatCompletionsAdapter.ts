import {
  AiError,
  type ModelAdapter,
  type ModelProfile,
  type ModelRequest,
  type ModelResponse,
} from '../contracts.ts';
import type { HttpTransport } from './http.ts';
import { post, tokens } from './http.ts';

export class ChatCompletionsAdapter implements ModelAdapter {
  constructor(private readonly transport: HttpTransport = fetch) {}
  async complete(
    p: ModelProfile,
    key: string,
    r: ModelRequest,
    signal: AbortSignal,
  ): Promise<ModelResponse> {
    const data = await post(
      this.transport,
      p,
      key,
      '/chat/completions',
      {
        model: p.model,
        messages: [
          { role: 'system', content: r.instructions },
          { role: 'user', content: r.input },
        ],
        ...(p.reasoningEffort === undefined
          ? { max_tokens: p.maxOutputTokens }
          : { max_completion_tokens: p.maxOutputTokens, reasoning_effort: p.reasoningEffort }),
        ...(p.temperature === undefined ? {} : { temperature: p.temperature }),
        response_format: {
          type: 'json_schema',
          json_schema: { name: r.schemaName, strict: true, schema: r.schema },
        },
      },
      signal,
    );
    const choice = data.choices?.[0];
    if (choice?.message?.refusal) throw new AiError('AI_REFUSAL');
    if (choice?.finish_reason !== 'stop') throw new AiError('AI_INCOMPLETE');
    if (typeof choice.message.content !== 'string' || !choice.message.content)
      throw new AiError('AI_EMPTY_RESPONSE');
    return {
      text: choice.message.content,
      actualModel: typeof data.model === 'string' ? data.model : undefined,
      inputTokens: tokens(data.usage?.prompt_tokens),
      outputTokens: tokens(data.usage?.completion_tokens),
    };
  }
}
