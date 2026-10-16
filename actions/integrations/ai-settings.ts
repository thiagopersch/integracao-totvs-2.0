"use server";

import { z } from "zod";
import { requirePermission } from "@/lib/rbac";
import { auditService } from "@/services/audit.service";
import { aiSettingsService } from "@/services/ai-settings.service";
import { runAiToolCall } from "@/lib/ai";

const aiSettingsSchema = z.object({
  provider: z.enum(["ANTHROPIC", "OPENAI"]),
  model: z.string().trim().min(1, "Informe o modelo").max(100),
  apiKey: z.string().trim().max(500).optional(),
  enabled: z.boolean(),
  instructions: z
    .string()
    .trim()
    .max(4000, "Instruções devem ter no máximo 4000 caracteres")
    .nullable()
    .transform((v) => v || null),
});

export async function getAiSettings() {
  const { organizationId } = await requirePermission("integrations", "execute");
  const settings = await aiSettingsService.get(organizationId);
  if (!settings) return null;
  // The API key is write-only: never sent back to the browser.
  return {
    provider: settings.provider,
    model: settings.model,
    enabled: settings.enabled,
    instructions: settings.instructions,
    hasApiKey: !!settings.apiKey,
  };
}

export async function saveAiSettings(input: unknown) {
  const { organizationId, userId } = await requirePermission("integrations", "execute");
  const parsed = aiSettingsSchema.safeParse(input);
  if (!parsed.success) return { success: false, error: parsed.error.issues[0]?.message ?? "Dados inválidos" };
  try {
    const { apiKey, ...rest } = parsed.data;
    await aiSettingsService.save(organizationId, { ...rest, apiKey: apiKey || undefined });
    await auditService.log({
      action: "UPDATE",
      entity: "AiSettings",
      entityId: organizationId,
      organizationId,
      userId,
      newData: { provider: rest.provider, model: rest.model, enabled: rest.enabled, apiKeyChanged: !!apiKey },
    });
    return { success: true };
  } catch (error) {
    return { success: false, error: (error as Error).message };
  }
}

/** Round-trip with the saved settings to validate key + model. */
export async function testAiSettings() {
  const { organizationId } = await requirePermission("integrations", "execute");
  const config = await aiSettingsService.getClientConfig(organizationId);
  if (!config) return { success: false, error: "Salve e ative a configuração antes de testar" };
  try {
    const result = await runAiToolCall(
      config,
      "Você é um verificador de conexão. Chame a ferramenta ping com ok=true.",
      [{ role: "user", content: "Teste de conexão." }],
      {
        name: "ping",
        description: "Confirma que a conexão funciona.",
        parameters: { type: "object", properties: { ok: { type: "boolean" } }, required: ["ok"], additionalProperties: false },
      }
    );
    const ok = !!result.toolInput || !!result.text;
    return ok
      ? { success: true, message: `Conexão OK com ${config.model}` }
      : { success: false, error: "O modelo respondeu vazio" };
  } catch (error) {
    return { success: false, error: (error as Error).message };
  }
}
