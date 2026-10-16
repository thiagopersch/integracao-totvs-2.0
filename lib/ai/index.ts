import { anthropicToolCall } from "./anthropic";
import { openaiToolCall } from "./openai";
import type { AiChatMessage, AiClientConfig, AiToolCallResult, AiToolDefinition } from "./types";

/** Provider-agnostic single tool call — the provider/model/key come from AiSettings (/integrations/ai). */
export function runAiToolCall(
  config: AiClientConfig,
  system: string,
  messages: AiChatMessage[],
  tool: AiToolDefinition
): Promise<AiToolCallResult> {
  return config.provider === "OPENAI"
    ? openaiToolCall(config, system, messages, tool)
    : anthropicToolCall(config, system, messages, tool);
}

export * from "./types";
