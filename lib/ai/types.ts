/** Mirrors the Prisma enum (plain union so client components can import it). */
export type AiProviderId = "ANTHROPIC" | "OPENAI";

export const AI_PROVIDER_LABELS: Record<AiProviderId, string> = {
  ANTHROPIC: "Anthropic (Claude)",
  OPENAI: "OpenAI",
};

/** Suggested models per provider — the field is free text, any model the account can use works. */
export const AI_MODEL_SUGGESTIONS: Record<AiProviderId, string[]> = {
  ANTHROPIC: ["claude-opus-5-5", "claude-sonnet-5-5", "claude-haiku-5-5"],
  OPENAI: ["gpt-5", "gpt-5-mini", "gpt-4.1"],
};

export const AI_DEFAULT_MODEL: Record<AiProviderId, string> = {
  ANTHROPIC: "claude-opus-5-5",
  OPENAI: "gpt-5",
};

export interface AiChatMessage {
  role: "user" | "assistant";
  content: string;
}

/** One function the model may call; `parameters` is a JSON Schema written for strict mode on both
 *  providers (every property required, nullable via `type: [..., "null"]`, no additional properties). */
export interface AiToolDefinition {
  name: string;
  description: string;
  parameters: Record<string, unknown>;
}

export interface AiToolCallResult {
  /** Parsed arguments of the tool call — null when the model answered in text only. */
  toolInput: unknown | null;
  text: string;
}

export interface AiClientConfig {
  provider: AiProviderId;
  model: string;
  apiKey: string;
}
