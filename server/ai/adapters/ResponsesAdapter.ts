import {
  AiError,
  type ModelAdapter,
  type ModelProfile,
  type ModelRequest,
  type ModelResponse,
} from '../contracts.ts';
import type { HttpTransport } from './http.ts';
import { post, tokens } from './http.ts';

export class ResponsesAdapter implements ModelAdapter {
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
      '/responses',
      {
        model: p.model,
        store: false,
        instructions: r.instructions,
        input: r.input,
        max_output_tokens: p.maxOutputTokens,
        ...(p.temperature === undefined ? {} : { temperature: p.temperature }),
        text: {
          format: { type: 'json_schema', name: r.schemaName, strict: true, schema: r.schema },
        },
      },
      signal,
    );
    if (data.status !== 'completed') throw new AiError('AI_INCOMPLETE');
    const content = (data.output || []).flatMap((o: { content?: unknown[] }) => o.content || []);
    if (content.some((c: { type: string }) => c.type === 'refusal'))
      throw new AiError('AI_REFUSAL');
    const text = content
      .filter((c: { type: string }) => c.type === 'output_text')
      .map((c: { text: string }) => c.text)
      .join('');
    if (!text) throw new AiError('AI_EMPTY_RESPONSE');
    return {
      text,
      actualModel: typeof data.model === 'string' ? data.model : undefined,
      inputTokens: tokens(data.usage?.input_tokens),
      outputTokens: tokens(data.usage?.output_tokens),
    };
  }
}
