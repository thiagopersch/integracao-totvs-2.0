import { ApiError, FinishReason, FunctionCallingConfigMode, GoogleGenAI } from "@google/genai"
import type { AiChatMessage, AiClientConfig, AiToolCallResult, AiToolDefinition } from "./types"

/** Google Gemini with one function declared from the same JSON Schema used by the other providers.
 *  Function calling runs in ANY mode (Gemini supports forcing it), so the answer is always a call. */
export async function geminiToolCall(
  config: AiClientConfig,
  system: string,
  messages: AiChatMessage[],
  tool: AiToolDefinition,
  signal?: AbortSignal
): Promise<AiToolCallResult> {
  const ai = new GoogleGenAI({ apiKey: config.apiKey })
  try {
    const response = await ai.models.generateContent({
      model: config.model,
      contents: messages.map((m) => ({
        role: m.role === "assistant" ? "model" : "user",
        parts: [{ text: m.content }],
      })),
      config: {
        abortSignal: signal,
        systemInstruction: system,
        tools: [
          {
            functionDeclarations: [
              { name: tool.name, description: tool.description, parametersJsonSchema: tool.parameters },
            ],
          },
        ],
        toolConfig: {
          functionCallingConfig: { mode: FunctionCallingConfigMode.ANY, allowedFunctionNames: [tool.name] },
        },
      },
    })

    if (response.promptFeedback?.blockReason) {
      throw new Error(`O Gemini bloqueou a solicitação (${response.promptFeedback.blockReason}). Reformule o pedido.`)
    }
    const finishReason = response.candidates?.[0]?.finishReason
    if (finishReason === FinishReason.SAFETY) throw new Error("O Gemini recusou a solicitação. Reformule o pedido.")
    if (finishReason === FinishReason.MAX_TOKENS) {
      throw new Error("A resposta da IA foi interrompida (limite de tokens). Tente pedir menos demandas por vez.")
    }

    const call = response.functionCalls?.find((c) => c.name === tool.name)
    // `.text` concatenates text parts only; read it only when there's no call (avoids SDK warnings on mixed parts).
    return { toolInput: call?.args ?? null, text: call ? "" : (response.text ?? "").trim() }
  } catch (error) {
    // `name` check too: bundlers can load two copies of the SDK, breaking `instanceof`.
    if (error instanceof ApiError || (error instanceof Error && error.name === "ApiError" && "status" in error)) {
      const status = (error as ApiError).status
      if (status === 400 && /api key/i.test(error.message)) throw new Error("Chave de API do Gemini inválida")
      if (status === 401 || status === 403) throw new Error("Chave de API do Gemini inválida ou sem permissão")
      if (status === 404) throw new Error(`Modelo "${config.model}" não encontrado no Gemini`)
      if (status === 429) throw new Error("Limite de uso da API do Gemini atingido — tente novamente em instantes")
      throw new Error(`Erro na API do Gemini (${status}): ${error.message}`)
    }
    if (error instanceof TypeError && /fetch/i.test(error.message)) {
      throw new Error("Erro na API do Gemini (rede): não foi possível conectar")
    }
    throw error
  }
}
