import { anthropicToolCall } from "./anthropic";
import { openaiToolCall } from "./openai";
import { geminiToolCall } from "./gemini";
import type { AiChatMessage, AiClientConfig, AiToolCallResult, AiToolDefinition } from "./types";

/** Provider-agnostic single tool call — the provider/model/key/timeout come from AiSettings
 *  (/integrations/ai). Gives up after `timeoutSeconds` with a message instead of a gateway timeout. */
export async function runAiToolCall(
  config: AiClientConfig,
  system: string,
  messages: AiChatMessage[],
  tool: AiToolDefinition
): Promise<AiToolCallResult> {
  const signal = AbortSignal.timeout(config.timeoutSeconds * 1000);
  try {
    switch (config.provider) {
      case "OPENAI":
        return await openaiToolCall(config, system, messages, tool, signal);
      case "GEMINI":
        return await geminiToolCall(config, system, messages, tool, signal);
      default:
        return await anthropicToolCall(config, system, messages, tool, signal);
    }
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
