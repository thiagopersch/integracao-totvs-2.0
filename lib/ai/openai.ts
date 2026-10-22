import OpenAI from "openai";
import type { AiChatMessage, AiClientConfig, AiToolCallResult, AiToolDefinition } from "./types";

/** OpenAI Chat Completions with one strict function. */
export async function openaiToolCall(
  config: AiClientConfig,
  system: string,
  messages: AiChatMessage[],
  tool: AiToolDefinition,
  signal?: AbortSignal
): Promise<AiToolCallResult> {
  const client = new OpenAI({ apiKey: config.apiKey });
  try {
    const response = await client.chat.completions.create({
      model: config.model,
      messages: [{ role: "system", content: system }, ...messages],
      tools: [
        {
          type: "function",
          function: { name: tool.name, description: tool.description, parameters: tool.parameters, strict: true },
        },
      ],
      tool_choice: "auto",
    }, { signal });
    const choice = response.choices[0];
    if (!choice) throw new Error("A OpenAI não retornou resposta");
    if (choice.finish_reason === "length") {
      throw new Error("A resposta da IA foi interrompida (limite de tokens). Tente pedir menos demandas por vez.");
    }
    if (choice.message.refusal) throw new Error(`O modelo recusou a solicitação: ${choice.message.refusal}`);

    let toolInput: unknown | null = null;
    for (const call of choice.message.tool_calls ?? []) {
      if (call.type === "function" && call.function.name === tool.name) {
        try {
          toolInput = JSON.parse(call.function.arguments);
        } catch {
          throw new Error("A IA retornou dados inválidos — tente novamente");
        }
      }
    }
    return { toolInput, text: (choice.message.content ?? "").trim() };
  } catch (error) {
    if (error instanceof OpenAI.APIUserAbortError) throw error;
    if (error instanceof OpenAI.AuthenticationError) throw new Error("Chave de API da OpenAI inválida");
    if (error instanceof OpenAI.NotFoundError) throw new Error(`Modelo "${config.model}" não encontrado na OpenAI`);
    if (error instanceof OpenAI.RateLimitError) throw new Error("Limite de uso da API da OpenAI atingido — tente novamente em instantes");
    if (error instanceof OpenAI.APIError) throw new Error(`Erro na API da OpenAI (${error.status ?? "rede"}): ${error.message}`);
    throw error;
  }
}
