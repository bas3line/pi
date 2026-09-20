import type { ProviderHeaders, ProviderStreams, StreamOptions } from "../types.ts";
import { getProviderEnvValue } from "../utils/provider-env.ts";

const COMMAND_CODE_ZDR_HEADER = "x-cmd-zdr";
const COMMAND_CODE_ZDR_ENV = "CMD_ZDR";

function hasHeader(headers: ProviderHeaders | undefined, name: string): boolean {
	const expected = name.toLowerCase();
	return Object.keys(headers ?? {}).some((key) => key.toLowerCase() === expected);
}

function withZdrHeader<TOptions extends StreamOptions>(options: TOptions | undefined): TOptions | undefined {
	if (!options || hasHeader(options.headers, COMMAND_CODE_ZDR_HEADER)) return options;
	if (getProviderEnvValue(COMMAND_CODE_ZDR_ENV, options.env) !== "1") return options;
	return {
		...options,
		headers: { ...options.headers, [COMMAND_CODE_ZDR_HEADER]: "1" },
	};
}

/**
 * Opts requests into Command Code's zero-data-retention routing when `CMD_ZDR=1`
 * is set, the same switch its own CLI exposes. The gateway then serves the request
 * from a ZDR-capable upstream or fails it with 422 `cmd_zdr_no_providers` rather
 * than falling back to one that retains data.
 */
export function withCommandCodeZdrHeader(streams: ProviderStreams): ProviderStreams {
	return {
		...streams,
		stream: (model, context, options) => streams.stream(model, context, withZdrHeader(options)),
		streamSimple: (model, context, options) => streams.streamSimple(model, context, withZdrHeader(options)),
	};
}
