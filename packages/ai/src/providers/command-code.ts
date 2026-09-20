import { anthropicMessagesApi } from "../api/anthropic-messages.lazy.ts";
import { openAICompletionsApi } from "../api/openai-completions.lazy.ts";
import { openAIResponsesApi } from "../api/openai-responses.lazy.ts";
import { envApiKeyAuth } from "../auth/helpers.ts";
import { createProvider, type Provider } from "../models.ts";
import { COMMAND_CODE_MODELS } from "./command-code.models.ts";
import { withCommandCodeZdrHeader } from "./command-code-headers.ts";

/**
 * Command Code's provider API. Claude models answer on `/v1/messages` only,
 * OpenAI models on `/v1/responses`, and the open models on
 * `/v1/chat/completions`; each model carries the baseUrl its API needs.
 */
export function commandCodeProvider(): Provider<"anthropic-messages" | "openai-completions" | "openai-responses"> {
	return createProvider<"anthropic-messages" | "openai-completions" | "openai-responses">({
		id: "command-code",
		name: "Command Code",
		auth: { apiKey: envApiKeyAuth("Command Code API key", ["CMD_API_KEY", "COMMAND_CODE_API_KEY"]) },
		models: Object.values(COMMAND_CODE_MODELS),
		api: {
			"anthropic-messages": withCommandCodeZdrHeader(anthropicMessagesApi()),
			"openai-completions": withCommandCodeZdrHeader(openAICompletionsApi()),
			"openai-responses": withCommandCodeZdrHeader(openAIResponsesApi()),
		},
	});
}
