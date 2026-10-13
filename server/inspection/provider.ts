import { ChatCompletionsAdapter, ResponsesAdapter } from '../ai/adapters.ts';
import { AiGateway } from '../ai/AiGateway.ts';
import { loadAiConfig } from '../ai/config.ts';

/** Domain adapter: translates inspection data to a provider-independent gateway request. */
import { GatewayAnalyzer } from './GatewayAnalyzer.ts';
export { GatewayAnalyzer } from './GatewayAnalyzer.ts';
export function createAiAnalyzer() {
  return new GatewayAnalyzer(
    new AiGateway(loadAiConfig(), {
      responses: new ResponsesAdapter(),
      'chat-completions': new ChatCompletionsAdapter(),
    }),
  );
}
