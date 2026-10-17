import { toZonedTime } from "date-fns-tz";
import { prisma } from "@/lib/prisma";
import { runAiToolCall, type AiChatMessage, type AiToolDefinition } from "@/lib/ai";
import {
  AI_ENTITIES,
  validateRecord,
  type AiCatalogItem,
  type AiCatalogKey,
  type AiCatalogs,
  type AiEntityKey,
  type AiFieldDef,
  type AiRecordProposal,
} from "@/lib/ai/entities";
import { aiSettingsService } from "@/services/ai-settings.service";
import { APP_TIME_ZONE } from "@/utils/format";

/** Max records per answer — keeps the preview reviewable and the tool output well under the token cap. */
const MAX_RECORDS = 40;
/** Conversation turns sent back to the model (oldest dropped first). */
const MAX_HISTORY = 20;

export interface AssistantResult {
  reply: string;
  questions: string[];
  proposals: AiRecordProposal[];
  /** Assistant turn to keep in the client-side history (reply + the proposals as JSON). */
  assistantMessage: string;
}

export interface ProposeInput {
  organizationId: string;
  messages: AiChatMessage[];
  /** Entities the user may create (create permission) — the only ones offered to the model. */
  entities: AiEntityKey[];
  catalogs: AiCatalogs;
  defaultAnalystId: string | null;
  analystScope: string | undefined;
  now?: Date;
}

function proposeRecordsTool(entities: AiEntityKey[]): AiToolDefinition {
  return {
    name: "propose_records",
    description:
      "Devolve os cadastros montados a partir do pedido do usuário para ele revisar e confirmar (nada é gravado por esta ferramenta). " +
      "Use sempre esta ferramenta para responder — inclusive só para perguntar (records vazio).",
    parameters: {
      type: "object",
      additionalProperties: false,
      required: ["reply", "questions", "records"],
      properties: {
        reply: { type: "string", description: "Resposta curta ao usuário, em português, resumindo o que foi montado." },
        questions: {
          type: "array",
          items: { type: "string" },
          description: "Perguntas sobre dados faltantes ou ambíguos (vazio quando estiver tudo claro).",
        },
        records: {
          type: "array",
          description: `Registros a criar (máximo ${MAX_RECORDS}), na ordem em que devem ser criados.`,
          items: {
            type: "object",
            additionalProperties: false,
            required: ["tempId", "entity", "fields"],
            properties: {
              tempId: { type: "string", description: "id temporário único no lote (ex.: r1, r2) — outros registros o referenciam como \"@r1\"" },
              entity: { type: "string", enum: entities, description: "tipo do cadastro" },
              fields: {
                type: "array",
                description: "campos do cadastro (chaves da seção ENTIDADES); omita os que não souber",
                items: {
                  type: "object",
                  additionalProperties: false,
                  required: ["key", "value"],
                  properties: {
                    key: { type: "string" },
                    value: { type: ["string", "null"] },
                  },
                },
              },
            },
          },
        },
      },
    },
  };
}

const CATALOG_TITLES: Record<AiCatalogKey, string> = {
  clients: "CLIENTES",
  analysts: "ANALISTAS",
  requesters: "SOLICITANTES",
  departments: "SETORES",
  demandTypes: "TIPOS DE DEMANDA",
  tags: "TAGS",
  contracts: "CONTRATOS (id | descrição | clienteId)",
  projects: "PROJETOS (id | nome | clienteId)",
  stages: "ETAPAS DE PROJETO (id | nome | projetoId)",
  users: "USUÁRIOS",
};

const lines = (items: AiCatalogItem[]) =>
  items.length ? items.map((i) => [i.id, i.name, ...(i.parentId !== undefined ? [i.parentId ?? "-"] : [])].join(" | ")).join("\n") : "(nenhum)";

function fieldLine(field: AiFieldDef) {
  const type =
    field.kind === "ref"
      ? `id de ${CATALOG_TITLES[field.ref!].split(" ")[0]}${refCreatable(field) ? " ou @tempId de um registro novo do lote" : ""}`
      : field.kind === "enum"
        ? field.options!.map((o) => `${o.value}=${o.label}`).join(", ")
        : { text: "texto", textarea: "texto longo", date: "YYYY-MM-DD", time: "HH:mm 24h", number: "número", bool: "true/false", color: "#RRGGBB" }[
            field.kind
          ];
  return `  - ${field.key}${field.required ? " (obrigatório)" : ""}: ${field.label} — ${type}${field.hint ? `; ${field.hint}` : ""}`;
}

const refCreatable = (field: AiFieldDef) => Object.values(AI_ENTITIES).some((d) => d.catalog === field.ref);

function todayLabel(now: Date) {
  const zoned = toZonedTime(now, APP_TIME_ZONE);
  const iso = `${zoned.getFullYear()}-${String(zoned.getMonth() + 1).padStart(2, "0")}-${String(zoned.getDate()).padStart(2, "0")}`;
  const weekday = zoned.toLocaleDateString("pt-BR", { weekday: "long" });
  return `${iso} (${weekday})`;
}

/** Last requester/department/type used per client — the defaults a person would pick by habit. */
async function recentDefaults(organizationId: string, clientIds: string[]) {
  if (!clientIds.length) return "";
  const latest = await prisma.demand.findMany({
    where: { organizationId, deletedAt: null, clientId: { in: clientIds } },
    orderBy: { date: "desc" },
    distinct: ["clientId"],
    select: {
      client: { select: { name: true } },
      requesterId: true,
      departmentId: true,
      demandTypeId: true,
      requester: { select: { name: true } },
      department: { select: { name: true } },
      demandType: { select: { name: true } },
    },
  });
  return latest
    .map(
      (d) =>
        `${d.client.name}: solicitante ${d.requester?.name ?? "-"} (${d.requesterId ?? "-"}), setor ${d.department?.name ?? "-"} (${d.departmentId ?? "-"}), tipo ${d.demandType?.name ?? "-"} (${d.demandTypeId ?? "-"})`
    )
    .join("\n");
}

export function buildSystemPrompt(input: {
  entities: AiEntityKey[];
  catalogs: AiCatalogs;
  defaultAnalystId: string | null;
  demandDefaults: string;
  instructions: string | null;
  now: Date;
}) {
  const { catalogs, entities } = input;
  const defaultAnalyst = catalogs.analysts?.find((a) => a.id === input.defaultAnalystId);
  const entitySections = entities.map((key) => {
    const def = AI_ENTITIES[key];
    return [`### ${def.label} (entity: ${key})`, ...(def.rules ? [`  ${def.rules}`] : []), ...def.fields.map(fieldLine)].join("\n");
  });
  const catalogSections = (Object.keys(CATALOG_TITLES) as AiCatalogKey[])
    .filter((k) => catalogs[k])
    .map((k) => `${CATALOG_TITLES[k]}:\n${lines(catalogs[k]!)}`);

  return [
    "Você é o assistente de cadastros de um sistema de gestão (atendimento a clientes, demandas/apontamento de horas e projetos).",
    "O usuário pede em texto livre o que quer cadastrar e você monta os registros chamando a ferramenta propose_records. Nada é gravado sem a confirmação do usuário na tela, registro a registro.",
    "",
    "Regras:",
    "- Responda SEMPRE chamando propose_records, em português.",
    "- Só crie os tipos listados em ENTIDADES. Se o usuário pedir outro tipo de cadastro, diga em reply que ainda não é possível por aqui.",
    "- Um pedido pode envolver vários tipos (ex.: um cliente novo e um projeto para ele). Para apontar para um registro que ainda vai ser criado no mesmo lote, use \"@tempId\" no campo de referência e liste o registro referenciado antes.",
    "- Use apenas ids das listas abaixo. Associe nomes de forma tolerante (apelidos, siglas, sem acento, parte do nome).",
    "- QUANDO TIVER DÚVIDA, PERGUNTE ANTES: se o tipo de cadastro não estiver claro, se um nome bater com mais de um item (ou com nenhum), ou se faltar um campo obrigatório que não dá para deduzir, coloque a pergunta em questions e NÃO invente valores. Pode devolver records vazio (só perguntas) ou com o que já está claro.",
    "- Se o usuário citar algo que não existe nas listas (ex.: cliente desconhecido), pergunte se deve cadastrá-lo também em vez de assumir.",
    "- Antes de criar algo que pareça já existir nas listas (mesmo nome), avise em questions.",
    "- Em ajustes (\"muda o prazo para sexta\"), devolva a lista COMPLETA atualizada, sem os registros que o usuário indicar como já criados (pode referenciá-los pelo id real informado).",
    "- Datas relativas (hoje, ontem, segunda passada...) são calculadas a partir de HOJE. Datas sem ano usam o ano atual.",
    ...(entities.includes("demand")
      ? [`- Analista padrão de demandas quando não informado: ${defaultAnalyst ? `${defaultAnalyst.name} (${defaultAnalyst.id})` : "nenhum — pergunte"}.`]
      : []),
    `- No máximo ${MAX_RECORDS} registros por resposta.`,
    ...(input.instructions ? ["", "Instruções da organização:", input.instructions] : []),
    "",
    "ENTIDADES (campos aceitos em fields):",
    ...entitySections,
    "",
    ...catalogSections.flatMap((s) => [s, ""]),
    ...(entities.includes("demand") ? [`ÚLTIMOS LANÇAMENTOS POR CLIENTE:\n${input.demandDefaults || "(nenhum)"}`, ""] : []),
    `HOJE: ${todayLabel(input.now)}`,
  ].join("\n");
}

const str = (v: unknown) => (typeof v === "string" ? v.trim() : "");

/** Normalizes one raw value against its field: unknown enum values and malformed dates/times are dropped. */
function normalize(field: AiFieldDef, raw: string): string {
  if (!raw) return "";
  switch (field.kind) {
    case "enum": {
      const match = field.options?.find((o) => o.value === raw.toUpperCase() || o.label.toLowerCase() === raw.toLowerCase());
      return match?.value ?? "";
    }
    case "date":
      return /^\d{4}-\d{2}-\d{2}$/.test(raw) ? raw : "";
    case "time":
      return /^\d{1,2}:\d{2}$/.test(raw) ? raw.padStart(5, "0") : "";
    case "bool":
      return ["true", "sim", "yes", "1"].includes(raw.toLowerCase()) ? "true" : "false";
    case "number":
      return raw.replace(",", ".");
    default:
      return raw.slice(0, 20000);
  }
}

/** Turns the raw tool output into proposals: unknown entities/fields are dropped, ids outside the
 *  catalogs and refs to records not in the batch are cleared, defaults applied, then every rule of
 *  the entity's create action is checked (errors shown on the card). */
export function toProposals(
  raw: unknown,
  ctx: { entities: AiEntityKey[]; catalogs: AiCatalogs; analystScope?: string | null; defaultAnalystId?: string | null }
): AiRecordProposal[] {
  const list = Array.isArray((raw as { records?: unknown })?.records) ? (raw as { records: unknown[] }).records : [];
  const seen = new Set<string>();
  const records = list.slice(0, MAX_RECORDS).flatMap((item, index) => {
    const r = (item ?? {}) as { tempId?: unknown; entity?: unknown; fields?: unknown };
    const entity = str(r.entity) as AiEntityKey;
    if (!ctx.entities.includes(entity)) return [];
    let tempId = str(r.tempId).replace(/^@/, "") || `r${index + 1}`;
    if (seen.has(tempId)) tempId = `${tempId}-${index + 1}`;
    seen.add(tempId);
    const rawFields = new Map<string, string>();
    for (const f of Array.isArray(r.fields) ? r.fields : []) {
      const key = str((f as { key?: unknown })?.key);
      if (key) rawFields.set(key, str((f as { value?: unknown })?.value));
    }
    return [{ tempId, entity, rawFields }];
  });

  const tempIds = new Map(records.map((r) => [r.tempId, r.entity]));
  return records.map(({ tempId, entity, rawFields }) => {
    const def = AI_ENTITIES[entity];
    const values: Record<string, string> = {};
    for (const field of def.fields) {
      let value = normalize(field, rawFields.get(field.key) ?? "");
      if (field.kind === "ref" && value) {
        if (value.startsWith("@")) {
          const target = tempIds.get(value.slice(1));
          if (!target || AI_ENTITIES[target].catalog !== field.ref || value.slice(1) === tempId) value = "";
        } else if (field.ref && ctx.catalogs[field.ref] && !ctx.catalogs[field.ref]!.some((i) => i.id === value)) {
          value = "";
        }
      }
      values[field.key] = value || def.defaults?.[field.key] || "";
    }
    if (entity === "demand") {
      values.analystId ||= ctx.defaultAnalystId ?? "";
      values.description ||= values.name;
    }
    const errors = validateRecord(entity, values, {
      catalogs: ctx.catalogs,
      batch: records,
      analystScope: ctx.analystScope,
    });
    return { tempId, entity, values, errors };
  });
}

export const aiAssistantService = {
  async isEnabled(organizationId: string) {
    const settings = await aiSettingsService.get(organizationId);
    return !!settings?.enabled;
  },

  async propose(input: ProposeInput): Promise<AssistantResult> {
    const config = await aiSettingsService.getClientConfig(input.organizationId);
    if (!config) throw new Error("Assistente IA não configurado — configure em Integrações > Assistente IA");
    if (!input.entities.length) throw new Error("Você não tem permissão para criar cadastros pelo assistente");

    const demandDefaults = input.entities.includes("demand")
      ? await recentDefaults(input.organizationId, (input.catalogs.clients ?? []).map((c) => c.id))
      : "";
    const system = buildSystemPrompt({
      entities: input.entities,
      catalogs: input.catalogs,
      defaultAnalystId: input.defaultAnalystId,
      demandDefaults,
      instructions: config.instructions,
      now: input.now ?? new Date(),
    });
    // History must start with a user turn on every provider.
    let messages = input.messages.slice(-MAX_HISTORY);
    while (messages.length && messages[0].role !== "user") messages = messages.slice(1);
    if (!messages.length) throw new Error("Descreva o que deseja cadastrar");

    const result = await runAiToolCall(config, system, messages, proposeRecordsTool(input.entities));
    const raw = (result.toolInput ?? {}) as { reply?: unknown; questions?: unknown };
    const proposals = toProposals(result.toolInput, input);
    const questions = Array.isArray(raw.questions) ? raw.questions.map(str).filter(Boolean) : [];
    const reply =
      str(raw.reply) ||
      result.text ||
      (proposals.length ? "Registros montados — revise e confirme." : questions.length ? "Preciso de algumas informações:" : "Não consegui montar nada com essas informações.");

    const compact = proposals.map(({ tempId, entity, values }) => ({
      tempId,
      entity,
      fields: Object.fromEntries(Object.entries(values).filter(([, v]) => v)),
    }));
    const assistantMessage = [
      reply,
      questions.length ? `Perguntas: ${questions.join(" | ")}` : "",
      proposals.length ? `Registros propostos (JSON): ${JSON.stringify(compact)}` : "",
    ]
      .filter(Boolean)
      .join("\n");
    return { reply, questions, proposals, assistantMessage };
  },
};
