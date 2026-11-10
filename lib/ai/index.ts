import { withSpan } from "@/lib/tracing";
import { anthropicToolCall } from "./anthropic";
import { openaiToolCall } from "./openai";
import { geminiToolCall } from "./gemini";
import type { AiChatMessage, AiClientConfig, AiDeltaHandler, AiToolCallResult, AiToolDefinition } from "./types";

/** Provider-agnostic single tool call — the provider/model/key/timeout come from AiSettings
 *  (/integrations/ai). Gives up after `timeoutSeconds` with a message instead of a gateway timeout. */
export async function runAiToolCall(
  config: AiClientConfig,
  system: string,
  messages: AiChatMessage[],
  tool: AiToolDefinition,
  /** When given, the provider streams and reports the tool-call JSON as it is generated. */
  onDelta?: AiDeltaHandler
): Promise<AiToolCallResult> {
  const signal = AbortSignal.timeout(config.timeoutSeconds * 1000);
  try {
    return await withSpan(`ai ${config.provider}`, { integration: "AI", "ai.provider": config.provider, "ai.model": config.model }, () => {
      switch (config.provider) {
        case "OPENAI":
          return openaiToolCall(config, system, messages, tool, signal, onDelta);
        case "GEMINI":
          return geminiToolCall(config, system, messages, tool, signal, onDelta);
        default:
          return anthropicToolCall(config, system, messages, tool, signal, onDelta);
      }
    });
  } catch (error) {
    // Each SDK wraps the abort differently; the signal is the one reliable witness.
    if (signal.aborted) {
      throw new Error(
        `A IA não respondeu em ${config.timeoutSeconds} s — peça menos registros por vez ou aumente o tempo limite em Integrações > Assistente IA`
      );
    }
    throw error;
  }
}

export * from "./types";
