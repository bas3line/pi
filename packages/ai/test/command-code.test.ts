import { describe, expect, it } from "vitest";
import { complete } from "../src/compat.ts";
import { MODELS } from "../src/models.generated.ts";
import { commandCodeProvider } from "../src/providers/command-code.ts";
import { withCommandCodeZdrHeader } from "../src/providers/command-code-headers.ts";
import type { Model, ProviderStreams, SimpleStreamOptions, StreamOptions } from "../src/types.ts";
import { AssistantMessageEventStream } from "../src/utils/event-stream.ts";
import { normalizeContext } from "../src/utils/transcript.ts";

const context = normalizeContext({ messages: [{ role: "user", content: "hi", timestamp: Date.now() }] });

function capturingStreams(): { streams: ProviderStreams; seen: (StreamOptions | undefined)[] } {
	const seen: (StreamOptions | undefined)[] = [];
	const streams: ProviderStreams = {
		stream: (_model, _context, options) => {
			seen.push(options);
			return new AssistantMessageEventStream();
		},
		streamSimple: (_model, _context, options: SimpleStreamOptions | undefined) => {
			seen.push(options);
			return new AssistantMessageEventStream();
		},
	};
	return { streams: withCommandCodeZdrHeader(streams), seen };
}

const model = Object.values(MODELS["command-code"])[0] as Model<any>;

describe("command-code provider", () => {
	it("routes each model to the API and base URL its endpoint serves", () => {
		for (const entry of Object.values(MODELS["command-code"]) as Model<any>[]) {
			if (entry.api === "anthropic-messages") {
				// The Anthropic SDK appends /v1/messages to the base URL.
				expect(entry.baseUrl).toBe("https://api.commandcode.ai/provider");
				expect(entry.id.startsWith("claude-")).toBe(true);
			} else {
				expect(entry.api === "openai-completions" || entry.api === "openai-responses").toBe(true);
				expect(entry.baseUrl).toBe("https://api.commandcode.ai/provider/v1");
			}
		}
	});

	it("sends the system prompt as a system message, which every upstream accepts", () => {
		for (const entry of Object.values(MODELS["command-code"]) as Model<any>[]) {
			if (entry.api !== "openai-completions") continue;
			const model = entry as Model<"openai-completions">;
			expect(model.compat?.supportsDeveloperRole).toBe(false);
		}
	});

	it("registers all three APIs", () => {
		const provider = commandCodeProvider();
		const apis = new Set(provider.getModels().map((entry) => entry.api));
		expect([...apis].sort()).toEqual(["anthropic-messages", "openai-completions", "openai-responses"]);
	});

	it("omits the ZDR header when CMD_ZDR is unset", () => {
		const { streams, seen } = capturingStreams();
		streams.stream(model, context, { env: {} });
		expect(seen[0]?.headers?.["x-cmd-zdr"]).toBeUndefined();
	});

	it("adds the ZDR header when CMD_ZDR=1", () => {
		const { streams, seen } = capturingStreams();
		streams.stream(model, context, { env: { CMD_ZDR: "1" } });
		streams.streamSimple(model, context, { env: { CMD_ZDR: "1" } });
		expect(seen[0]?.headers?.["x-cmd-zdr"]).toBe("1");
		expect(seen[1]?.headers?.["x-cmd-zdr"]).toBe("1");
	});

	it("keeps a caller-supplied ZDR header", () => {
		const { streams, seen } = capturingStreams();
		streams.stream(model, context, { env: { CMD_ZDR: "1" }, headers: { "X-Cmd-Zdr": "0" } });
		expect(seen[0]?.headers).toEqual({ "X-Cmd-Zdr": "0" });
	});
});

// One model per API rather than the whole catalog: this proves the three routes
// without a four-minute run whose failures are upstream availability, not pi.
const SMOKE_MODEL_IDS = ["claude-sonnet-5", "gpt-5.6-luna", "moonshotai/Kimi-K3"];

describe.skipIf(!process.env.CMD_API_KEY)("Command Code Models Smoke Test", () => {
	for (const id of SMOKE_MODEL_IDS) {
		const entry = (MODELS["command-code"] as Record<string, Model<any>>)[id];
		it(`Command Code: ${id}`, async () => {
			expect(entry).toBeTruthy();
			const response = await complete(entry, {
				messages: [{ role: "user", content: "Say hello.", timestamp: Date.now() }],
			});

			expect(response.content).toBeTruthy();
			expect(response.stopReason).toBe("stop");
		}, 60000);
	}
});
