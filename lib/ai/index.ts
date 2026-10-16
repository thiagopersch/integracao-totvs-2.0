import { anthropicToolCall } from "./anthropic";
import { openaiToolCall } from "./openai";
import { geminiToolCall } from "./gemini";
import type { AiChatMessage, AiClientConfig, AiToolCallResult, AiToolDefinition } from "./types";

/** Provider-agnostic single tool call — the provider/model/key come from AiSettings (/integrations/ai). */
export function runAiToolCall(
  config: AiClientConfig,
  system: string,
  messages: AiChatMessage[],
  tool: AiToolDefinition
): Promise<AiToolCallResult> {
  switch (config.provider) {
    case "OPENAI":
      return openaiToolCall(config, system, messages, tool);
    case "GEMINI":
      return geminiToolCall(config, system, messages, tool);
    default:
      return anthropicToolCall(config, system, messages, tool);
  }
}

export * from "./types";
