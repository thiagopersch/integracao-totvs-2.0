import Anthropic from "@anthropic-ai/sdk";
import type { AiChatMessage, AiClientConfig, AiToolCallResult, AiToolDefinition } from "./types";

/**
 * Claude via the Messages API with one strict tool. `tool_choice` stays "auto" (forcing a tool is
 * rejected by current models) — the system prompt tells the model when to call it. Server-side
 * refusal fallbacks are opted into with the "default" mode (a no-op on models without fallbacks).
 */
export async function anthropicToolCall(
  config: AiClientConfig,
  system: string,
  messages: AiChatMessage[],
  tool: AiToolDefinition
): Promise<AiToolCallResult> {
  const client = new Anthropic({ apiKey: config.apiKey });
  try {
    const response = await client.beta.messages.create({
      model: config.model,
      max_tokens: 16000,
      betas: ["server-side-fallback-2026-07-01"],
      fallbacks: "default",
      system,
      messages,
      tools: [
        {
          name: tool.name,
          description: tool.description,
          input_schema: tool.parameters as Anthropic.Beta.BetaTool.InputSchema,
          strict: true,
        },
      ],
      tool_choice: { type: "auto" },
    });

    if (response.stop_reason === "refusal") {
      throw new Error("O modelo recusou a solicitação. Reformule o pedido.");
    }
    if (response.stop_reason === "max_tokens") {
      throw new Error("A resposta da IA foi interrompida (limite de tokens). Tente pedir menos demandas por vez.");
    }

    let toolInput: unknown | null = null;
    const texts: string[] = [];
    for (const block of response.content) {
      if (block.type === "tool_use" && block.name === tool.name) toolInput = block.input;
      else if (block.type === "text") texts.push(block.text);
    }
    return { toolInput, text: texts.join("\n").trim() };
  } catch (error) {
    if (error instanceof Anthropic.AuthenticationError) throw new Error("Chave de API da Anthropic inválida");
    if (error instanceof Anthropic.NotFoundError) throw new Error(`Modelo "${config.model}" não encontrado na Anthropic`);
    if (error instanceof Anthropic.RateLimitError) throw new Error("Limite de uso da API da Anthropic atingido — tente novamente em instantes");
    if (error instanceof Anthropic.BadRequestError) throw new Error(`Requisição recusada pela Anthropic: ${error.message}`);
    if (error instanceof Anthropic.APIError) throw new Error(`Erro na API da Anthropic (${error.status ?? "rede"}): ${error.message}`);
    throw error;
  }
}
