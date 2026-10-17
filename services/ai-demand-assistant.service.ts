import { toZonedTime } from "date-fns-tz";
import { prisma } from "@/lib/prisma";
import { runAiToolCall, type AiChatMessage, type AiToolDefinition } from "@/lib/ai";
import {
  PROPOSAL_PRIORITIES as PRIORITIES,
  PROPOSAL_STATUSES as STATUSES,
  validateProposal,
  type DemandProposal,
} from "@/lib/ai/demand-proposal";
import { aiSettingsService } from "@/services/ai-settings.service";
import { APP_TIME_ZONE } from "@/utils/format";

/** Max demands per answer — keeps the preview reviewable and the tool output well under the token cap. */
const MAX_DEMANDS = 40;
/** Conversation turns sent back to the model (oldest dropped first). */
const MAX_HISTORY = 20;


export interface CatalogItem {
  id: string;
  name: string;
}

export interface AssistantCatalogs {
  clients: CatalogItem[];
  analysts: CatalogItem[];
  requesters: CatalogItem[];
  departments: CatalogItem[];
  demandTypes: CatalogItem[];
}

export interface AssistantResult {
  reply: string;
  questions: string[];
  proposals: DemandProposal[];
  /** Assistant turn to keep in the client-side history (reply + the proposals as JSON). */
  assistantMessage: string;
}

const nullableString = (description: string) => ({ type: ["string", "null"], description });

const PROPOSE_DEMANDS_TOOL: AiToolDefinition = {
  name: "propose_demands",
  description:
    "Devolve as demandas montadas a partir do pedido do usuário para ele revisar e confirmar (nada é gravado por esta ferramenta). " +
    "Sempre use esta ferramenta para responder, mesmo quando faltarem dados (preencha o que souber, deixe null o resto e pergunte em questions).",
  parameters: {
    type: "object",
    additionalProperties: false,
    required: ["reply", "questions", "demands"],
    properties: {
      reply: { type: "string", description: "Resposta curta ao usuário, em português, resumindo o que foi montado." },
      questions: {
        type: "array",
        items: { type: "string" },
        description: "Perguntas sobre dados faltantes ou ambíguos (vazio quando estiver tudo claro).",
      },
      demands: {
        type: "array",
        description: `Demandas a lançar (máximo ${MAX_DEMANDS}). Uma entrada por demanda: se o usuário pedir N demandas ou N dias, gere N entradas.`,
        items: {
          type: "object",
          additionalProperties: false,
          required: [
            "clientId",
            "analystId",
            "requesterId",
            "departmentId",
            "demandTypeId",
            "date",
            "startTime",
            "endTime",
            "name",
            "description",
            "priority",
            "status",
            "notes",
          ],
          properties: {
            clientId: nullableString("id do cliente (lista CLIENTES), ou null se não identificado"),
            analystId: nullableString("id do analista (lista ANALISTAS), ou null se não identificado"),
            requesterId: nullableString("id do solicitante (lista SOLICITANTES), ou null"),
            departmentId: nullableString("id do setor/departamento (lista SETORES), ou null"),
            demandTypeId: nullableString("id do tipo de demanda (lista TIPOS), ou null"),
            date: nullableString("data no formato YYYY-MM-DD"),
            startTime: nullableString("hora de início HH:mm (24h)"),
            endTime: nullableString("hora de término HH:mm (24h), depois do início"),
            name: nullableString("título curto da demanda"),
            description: nullableString("descrição da demanda"),
            priority: nullableString("LOW, MEDIUM, HIGH ou URGENT (null = MEDIUM)"),
            status: nullableString("PENDING, IN_PROGRESS, COMPLETED ou CANCELLED (null = COMPLETED)"),
            notes: nullableString("observações, ou null"),
          },
        },
      },
    },
  },
};

const lines = (items: CatalogItem[]) => (items.length ? items.map((i) => `${i.id} | ${i.name}`).join("\n") : "(nenhum)");

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

function buildSystemPrompt(input: {
  catalogs: AssistantCatalogs;
  defaultAnalystId: string | null;
  defaults: string;
  instructions: string | null;
  now: Date;
}) {
  const { catalogs } = input;
  const defaultAnalyst = catalogs.analysts.find((a) => a.id === input.defaultAnalystId);
  return [
    "Você é o assistente de lançamento de demandas (apontamento de horas de atendimento a clientes) de um sistema de gestão.",
    "O usuário descreve em texto livre o que fez (cliente, analista, data, horário de início e fim, quantidade, assunto) e você monta as demandas chamando a ferramenta propose_demands. Nada é gravado sem a confirmação do usuário na tela.",
    "",
    "Regras:",
    "- Responda SEMPRE chamando propose_demands, em português.",
    "- Use apenas ids das listas abaixo. Associe nomes de forma tolerante (apelidos, siglas, sem acento, parte do nome). Se houver mais de um candidato plausível ou nenhum, use null e pergunte em questions.",
    `- Analista padrão quando não informado: ${defaultAnalyst ? `${defaultAnalyst.name} (${defaultAnalyst.id})` : "nenhum — pergunte"}.`,
    "- Solicitante, setor e tipo não informados: use os do último lançamento do cliente (lista ÚLTIMOS LANÇAMENTOS) quando houver; senão null.",
    "- Datas relativas (hoje, ontem, segunda passada...) são calculadas a partir de HOJE. Datas sem ano usam o ano atual.",
    "- Quantidade: \"3 demandas\" = 3 entradas; \"de segunda a sexta\" = uma entrada por dia útil; repita horários quando o usuário der um só.",
    "- Horas sem horário (\"2 horas\"): se houver hora de início, calcule o término; senão pergunte.",
    "- Título: curto e objetivo, derivado do assunto. Descrição: o detalhamento informado (ou o próprio título se nada mais for dito).",
    "- status padrão COMPLETED (trabalho já realizado) e prioridade padrão MEDIUM, salvo indicação.",
    "- Em ajustes (\"muda a segunda para 14h\"), devolva a lista COMPLETA atualizada, sem as demandas que o usuário indicar como já criadas.",
    `- No máximo ${MAX_DEMANDS} demandas por resposta.`,
    ...(input.instructions ? ["", "Instruções da organização:", input.instructions] : []),
    "",
    `CLIENTES:\n${lines(catalogs.clients)}`,
    "",
    `ANALISTAS:\n${lines(catalogs.analysts)}`,
    "",
    `SOLICITANTES:\n${lines(catalogs.requesters)}`,
    "",
    `SETORES:\n${lines(catalogs.departments)}`,
    "",
    `TIPOS:\n${lines(catalogs.demandTypes)}`,
    "",
    `ÚLTIMOS LANÇAMENTOS POR CLIENTE:\n${input.defaults || "(nenhum)"}`,
    "",
    `HOJE: ${todayLabel(input.now)}`,
  ].join("\n");
}

const str = (v: unknown) => (typeof v === "string" ? v.trim() : "");
const idIn = (v: unknown, items: CatalogItem[]) => {
  const id = str(v);
  return items.some((i) => i.id === id) ? id : "";
};

/** Turns the raw tool output into proposals: unknown ids are dropped, defaults applied, and every
 *  field createDemandSchema (or the analyst scope) would reject is reported in `errors`. */
export function toProposals(raw: unknown, catalogs: AssistantCatalogs, analystScope: string | undefined): DemandProposal[] {
  const list = Array.isArray((raw as { demands?: unknown })?.demands) ? (raw as { demands: unknown[] }).demands : [];
  return list.slice(0, MAX_DEMANDS).map((item) => {
    const d = (item ?? {}) as Record<string, unknown>;
    const priority = (PRIORITIES as readonly string[]).includes(str(d.priority)) ? (str(d.priority) as DemandProposal["priority"]) : "MEDIUM";
    const status = (STATUSES as readonly string[]).includes(str(d.status)) ? (str(d.status) as DemandProposal["status"]) : "COMPLETED";
    const name = str(d.name).slice(0, 200);
    const proposal: DemandProposal = {
      name,
      description: str(d.description) || name,
      date: /^\d{4}-\d{2}-\d{2}$/.test(str(d.date)) ? str(d.date) : "",
      startTime: str(d.startTime),
      endTime: str(d.endTime),
      priority,
      status,
      notes: str(d.notes),
      clientId: idIn(d.clientId, catalogs.clients),
      analystId: idIn(d.analystId, catalogs.analysts),
      requesterId: idIn(d.requesterId, catalogs.requesters),
      departmentId: idIn(d.departmentId, catalogs.departments),
      demandTypeId: idIn(d.demandTypeId, catalogs.demandTypes),
      errors: {},
    };
    proposal.errors = validateProposal(proposal, analystScope);
    return proposal;
  });
}

export const aiDemandAssistantService = {
  async isEnabled(organizationId: string) {
    const settings = await aiSettingsService.get(organizationId);
    return !!settings?.enabled;
  },

  async propose(input: {
    organizationId: string;
    messages: AiChatMessage[];
    catalogs: AssistantCatalogs;
    defaultAnalystId: string | null;
    analystScope: string | undefined;
    now?: Date;
  }): Promise<AssistantResult> {
    const config = await aiSettingsService.getClientConfig(input.organizationId);
    if (!config) throw new Error("Assistente IA não configurado — configure em Integrações > Assistente IA");

    const defaults = await recentDefaults(
      input.organizationId,
      input.catalogs.clients.map((c) => c.id)
    );
    const system = buildSystemPrompt({
      catalogs: input.catalogs,
      defaultAnalystId: input.defaultAnalystId,
      defaults,
      instructions: config.instructions,
      now: input.now ?? new Date(),
    });
    // History must start with a user turn on both providers.
    let messages = input.messages.slice(-MAX_HISTORY);
    while (messages.length && messages[0].role !== "user") messages = messages.slice(1);
    if (!messages.length) throw new Error("Descreva as demandas que deseja lançar");

    const result = await runAiToolCall(config, system, messages, PROPOSE_DEMANDS_TOOL);
    const raw = (result.toolInput ?? {}) as { reply?: unknown; questions?: unknown };
    const proposals = toProposals(result.toolInput, input.catalogs, input.analystScope);
    const questions = Array.isArray(raw.questions) ? raw.questions.map(str).filter(Boolean) : [];
    const reply = str(raw.reply) || result.text || (proposals.length ? "Demandas montadas — revise e confirme." : "Não consegui montar demandas com essas informações.");

    // eslint-disable-next-line @typescript-eslint/no-unused-vars -- errors are UI-only, not model context
    const compact = proposals.map(({ errors, ...fields }) => fields);
    const assistantMessage = [
      reply,
      questions.length ? `Perguntas: ${questions.join(" | ")}` : "",
      proposals.length ? `Demandas propostas (JSON): ${JSON.stringify(compact)}` : "",
    ]
      .filter(Boolean)
      .join("\n");
    return { reply, questions, proposals, assistantMessage };
  },
};
