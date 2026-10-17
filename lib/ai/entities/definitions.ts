import { createDemandSchema } from "@/schemas/demand.schema";
import { createClientSchema } from "@/schemas/client.schema";
import { createAnalystSchema } from "@/schemas/analyst.schema";
import { createRequesterSchema } from "@/schemas/requester.schema";
import { createDepartmentSchema } from "@/schemas/department.schema";
import { createDemandTypeSchema } from "@/schemas/demand-type.schema";
import { createTagSchema } from "@/schemas/tag.schema";
import { createContractSchema } from "@/schemas/contract.schema";
import { projectSchema } from "@/schemas/project.schema";
import { projectTaskSchema } from "@/schemas/project-task.schema";
import { customFieldDefinitionSchema } from "@/schemas/custom-field.schema";
import {
  DEFAULT_PROJECT_SETTINGS,
  DEFAULT_STAGES,
  PRIORITIES,
  PRIORITY_LABELS,
  PROJECT_STATUSES,
  PROJECT_STATUS_LABELS,
} from "@/lib/projects";
import {
  CUSTOM_FIELD_ENTITIES,
  CUSTOM_FIELD_ENTITY_LABELS,
  CUSTOM_FIELD_TYPES,
  CUSTOM_FIELD_TYPE_LABELS,
  OPTION_FIELD_TYPES,
  type CustomFieldType,
} from "@/lib/custom-fields";
import type { AiEntityDef, AiEntityKey } from "./types";

const opt = <T extends string>(values: readonly T[], labels: Record<T, string>) => values.map((value) => ({ value, label: labels[value] }));

const DEMAND_STATUS_LABELS = { PENDING: "Pendente", IN_PROGRESS: "Em andamento", COMPLETED: "Concluída", CANCELLED: "Cancelada" } as const;
export const DEMAND_STATUSES = ["PENDING", "IN_PROGRESS", "COMPLETED", "CANCELLED"] as const;
const CONTRACT_STATUS_LABELS = { ACTIVE: "Ativo", SUSPENDED: "Suspenso", EXPIRED: "Expirado", CANCELLED: "Cancelado" } as const;
const CONTRACT_STATUSES = ["ACTIVE", "SUSPENDED", "EXPIRED", "CANCELLED"] as const;

/** "" → undefined, so optional schema fields stay unset. */
const opt$ = (v: string | undefined) => (v ? v : undefined);
const num = (v: string | undefined) => {
  if (!v) return undefined;
  const n = Number(v.replace(",", "."));
  return Number.isFinite(n) ? n : NaN;
};
const bool = (v: string | undefined) => v === "true";

const priority = { key: "priority", label: "Prioridade", kind: "enum", options: opt(PRIORITIES, PRIORITY_LABELS) } as const;
const color = (fallback: string) => ({ key: "color", label: "Cor", kind: "color", hint: `hex #RRGGBB (padrão ${fallback})` }) as const;

/** Option labels typed by the user ("Alta, Média, Baixa") → definition options. Ids only need to be unique per field. */
export function parseOptionLabels(text: string) {
  return text
    .split(/[,;\n]/)
    .map((label) => label.trim())
    .filter(Boolean)
    .map((label, i) => ({ id: `opt-${i + 1}`, label, color: null }));
}

const demand: AiEntityDef = {
  key: "demand",
  label: "Demanda",
  resource: "demands",
  titleField: "name",
  defaults: { priority: "MEDIUM", status: "COMPLETED" },
  fields: [
    { key: "clientId", label: "Cliente", kind: "ref", ref: "clients", required: true },
    { key: "analystId", label: "Analista", kind: "ref", ref: "analysts", required: true },
    { key: "requesterId", label: "Solicitante", kind: "ref", ref: "requesters", required: true },
    { key: "departmentId", label: "Setor", kind: "ref", ref: "departments", required: true },
    { key: "demandTypeId", label: "Tipo", kind: "ref", ref: "demandTypes", required: true },
    { key: "status", label: "Status", kind: "enum", options: opt(DEMAND_STATUSES, DEMAND_STATUS_LABELS) },
    { key: "date", label: "Data", kind: "date", required: true },
    { key: "startTime", label: "Início", kind: "time", required: true },
    { key: "endTime", label: "Fim", kind: "time", required: true, hint: "depois do início" },
    priority,
    { key: "projectId", label: "Projeto", kind: "ref", ref: "projects", parentField: "clientId", hint: "opcional; projeto do mesmo cliente" },
    { key: "name", label: "Título", kind: "text", required: true, wide: true, hint: "curto, derivado do assunto (mín. 3 caracteres)" },
    { key: "description", label: "Descrição", kind: "textarea", required: true, wide: true, hint: "detalhamento; se nada mais for dito, repita o título" },
    { key: "notes", label: "Observações", kind: "textarea", wide: true },
  ],
  rules: [
    "Demanda = apontamento de horas de atendimento a um cliente.",
    "\"3 demandas\" = 3 registros; \"de segunda a sexta\" = um registro por dia útil; repita horários quando o usuário der um só.",
    "Horas sem horário (\"2 horas\"): se houver início, calcule o fim; senão pergunte.",
    "Solicitante, setor e tipo não informados: use os do último lançamento do cliente (ÚLTIMOS LANÇAMENTOS) quando houver; senão pergunte.",
    "status padrão COMPLETED (trabalho já realizado) e prioridade MEDIUM, salvo indicação.",
  ].join(" "),
  schema: createDemandSchema,
  toInput: (v) => ({
    name: v.name,
    description: v.description,
    date: v.date,
    startTime: v.startTime,
    endTime: v.endTime,
    priority: v.priority,
    status: v.status,
    notes: opt$(v.notes),
    analystId: v.analystId,
    clientId: v.clientId,
    requesterId: v.requesterId,
    departmentId: v.departmentId,
    demandTypeId: v.demandTypeId,
    projectId: opt$(v.projectId),
    tagIds: [],
  }),
};

const client: AiEntityDef = {
  key: "client",
  label: "Cliente",
  resource: "clients",
  catalog: "clients",
  titleField: "name",
  fields: [
    { key: "name", label: "Nome", kind: "text", required: true },
    { key: "legalName", label: "Razão social", kind: "text" },
    { key: "document", label: "CPF/CNPJ", kind: "text", hint: "só se o usuário informar" },
    { key: "email", label: "E-mail", kind: "text" },
    { key: "phone", label: "Telefone", kind: "text" },
    { key: "responsible", label: "Responsável", kind: "text" },
    { key: "site", label: "Site", kind: "text", hint: "URL completa com https://" },
    { key: "linkCrm", label: "Link CRM", kind: "text", hint: "URL completa com https://" },
    color("#22c55e"),
    { key: "notes", label: "Observações", kind: "textarea", wide: true },
  ],
  schema: createClientSchema,
  toInput: (v) => ({
    name: v.name,
    legalName: opt$(v.legalName),
    document: v.document ?? "",
    linkCrm: opt$(v.linkCrm),
    site: opt$(v.site),
    email: v.email ?? "",
    phone: v.phone ?? "",
    responsible: opt$(v.responsible),
    color: v.color || "#22c55e",
    notes: opt$(v.notes),
    favorite: false,
    status: true,
  }),
};

const analyst: AiEntityDef = {
  key: "analyst",
  label: "Analista",
  resource: "analysts",
  catalog: "analysts",
  titleField: "name",
  defaults: { level: "1" },
  fields: [
    { key: "name", label: "Nome", kind: "text", required: true },
    { key: "email", label: "E-mail", kind: "text", required: true },
    { key: "hourlyRate", label: "Valor/hora (R$)", kind: "number", required: true, hint: "maior que zero; pergunte se não informado" },
    { key: "level", label: "Nível (1-5)", kind: "number", required: true },
    { key: "role", label: "Cargo", kind: "text" },
    { key: "team", label: "Time", kind: "text" },
    { key: "phone", label: "Telefone", kind: "text" },
    color("#6366f1"),
  ],
  schema: createAnalystSchema,
  toInput: (v) => ({
    name: v.name,
    email: v.email ?? "",
    phone: v.phone ?? "",
    role: opt$(v.role),
    hourlyRate: num(v.hourlyRate),
    team: opt$(v.team),
    color: v.color || "#6366f1",
    level: num(v.level) ?? 1,
    status: true,
  }),
};

const requester: AiEntityDef = {
  key: "requester",
  label: "Solicitante",
  resource: "requesters",
  catalog: "requesters",
  titleField: "name",
  fields: [
    { key: "name", label: "Nome", kind: "text", required: true },
    { key: "email", label: "E-mail", kind: "text" },
    { key: "phone", label: "Telefone", kind: "text" },
  ],
  schema: createRequesterSchema,
  toInput: (v) => ({ name: v.name, email: v.email ?? "", phone: v.phone ?? "", status: true }),
};

const department: AiEntityDef = {
  key: "department",
  label: "Setor",
  resource: "departments",
  catalog: "departments",
  titleField: "name",
  fields: [
    { key: "name", label: "Nome", kind: "text", required: true },
    { key: "description", label: "Descrição", kind: "textarea", wide: true },
  ],
  schema: createDepartmentSchema,
  toInput: (v) => ({ name: v.name, description: opt$(v.description) }),
};

const demandType: AiEntityDef = {
  key: "demandType",
  label: "Tipo de demanda",
  resource: "demand_types",
  catalog: "demandTypes",
  titleField: "name",
  fields: [
    { key: "name", label: "Nome", kind: "text", required: true },
    color("#a855f7"),
    { key: "description", label: "Descrição", kind: "textarea", wide: true },
  ],
  schema: createDemandTypeSchema,
  toInput: (v) => ({ name: v.name, description: opt$(v.description), color: v.color || "#a855f7" }),
};

const tag: AiEntityDef = {
  key: "tag",
  label: "Tag",
  resource: "tags",
  catalog: "tags",
  titleField: "name",
  fields: [{ key: "name", label: "Nome", kind: "text", required: true }, color("#8b5cf6")],
  schema: createTagSchema,
  toInput: (v) => ({ name: v.name, color: v.color || "#8b5cf6" }),
};

const contract: AiEntityDef = {
  key: "contract",
  label: "Contrato",
  resource: "contracts",
  catalog: "contracts",
  titleField: "contractedHours",
  defaults: { status: "ACTIVE" },
  fields: [
    { key: "clientId", label: "Cliente", kind: "ref", ref: "clients", required: true },
    { key: "contractedHours", label: "Horas contratadas (mês)", kind: "number", required: true },
    { key: "startDate", label: "Início", kind: "date", required: true },
    { key: "endDate", label: "Término", kind: "date" },
    { key: "status", label: "Status", kind: "enum", options: opt(CONTRACT_STATUSES, CONTRACT_STATUS_LABELS) },
    { key: "notes", label: "Observações", kind: "textarea", wide: true },
  ],
  schema: createContractSchema,
  toInput: (v) => ({
    clientId: v.clientId,
    contractedHours: num(v.contractedHours),
    startDate: v.startDate,
    endDate: v.endDate ?? "",
    status: v.status || "ACTIVE",
    notifyClient: false,
    notes: opt$(v.notes),
  }),
};

const project: AiEntityDef = {
  key: "project",
  label: "Projeto",
  resource: "projects",
  catalog: "projects",
  titleField: "name",
  defaults: { status: "PLANNING", priority: "MEDIUM" },
  fields: [
    { key: "name", label: "Nome", kind: "text", required: true, wide: true },
    { key: "clientId", label: "Cliente", kind: "ref", ref: "clients", hint: "opcional" },
    { key: "contractId", label: "Contrato", kind: "ref", ref: "contracts", parentField: "clientId", hint: "opcional; exige cliente" },
    { key: "managerId", label: "Gerente", kind: "ref", ref: "users", hint: "opcional" },
    { key: "status", label: "Status", kind: "enum", options: opt(PROJECT_STATUSES, PROJECT_STATUS_LABELS) },
    priority,
    { key: "plannedStartDate", label: "Início previsto", kind: "date" },
    { key: "plannedEndDate", label: "Término previsto", kind: "date" },
    { key: "budgetHours", label: "Orçamento (horas)", kind: "number" },
    color("#6366f1"),
    { key: "description", label: "Descrição", kind: "textarea", wide: true },
    { key: "objective", label: "Objetivo", kind: "textarea", wide: true },
  ],
  rules: "O projeto é criado com as etapas e visualizações padrão; o código é gerado automaticamente.",
  schema: projectSchema,
  toInput: (v) => ({
    name: v.name,
    description: opt$(v.description),
    objective: opt$(v.objective),
    clientId: opt$(v.clientId),
    contractId: opt$(v.contractId),
    managerId: opt$(v.managerId),
    status: v.status || "PLANNING",
    priority: v.priority || "MEDIUM",
    plannedStartDate: v.plannedStartDate ?? "",
    plannedEndDate: v.plannedEndDate ?? "",
    budgetHours: num(v.budgetHours) ?? null,
    color: v.color || "#6366f1",
    memberIds: [],
    settings: DEFAULT_PROJECT_SETTINGS,
    stages: DEFAULT_STAGES,
    phases: [],
    customFields: {},
  }),
};

const projectTask: AiEntityDef = {
  key: "projectTask",
  label: "Tarefa de projeto",
  resource: "project_tasks",
  titleField: "title",
  defaults: { priority: "MEDIUM" },
  fields: [
    { key: "projectId", label: "Projeto", kind: "ref", ref: "projects", required: true },
    { key: "title", label: "Título", kind: "text", required: true, wide: true },
    { key: "stageId", label: "Etapa", kind: "ref", ref: "stages", parentField: "projectId", hint: "opcional; vazio = primeira etapa \"a fazer\"" },
    { key: "assigneeId", label: "Responsável", kind: "ref", ref: "users", hint: "opcional; membro do projeto" },
    priority,
    { key: "startDate", label: "Início", kind: "date" },
    { key: "dueDate", label: "Prazo", kind: "date" },
    { key: "estimateHours", label: "Estimativa (h)", kind: "number" },
    { key: "description", label: "Descrição", kind: "textarea", wide: true },
  ],
  schema: projectTaskSchema,
  toInput: (v) => ({
    title: v.title,
    description: opt$(v.description),
    // Empty = the project's first "a fazer" stage, resolved right before creating.
    stageId: v.stageId || "default",
    priority: v.priority || "MEDIUM",
    assigneeId: opt$(v.assigneeId),
    startDate: v.startDate ?? "",
    dueDate: v.dueDate ?? "",
    estimateHours: num(v.estimateHours) ?? null,
    tagIds: [],
    customFields: {},
  }),
};

const customField: AiEntityDef = {
  key: "customField",
  label: "Propriedade",
  resource: "project_custom_fields",
  titleField: "label",
  defaults: { entity: "PROJECT", required: "false" },
  fields: [
    { key: "label", label: "Nome", kind: "text", required: true },
    { key: "entity", label: "Aplica-se a", kind: "enum", required: true, options: opt(CUSTOM_FIELD_ENTITIES, CUSTOM_FIELD_ENTITY_LABELS) },
    { key: "type", label: "Tipo", kind: "enum", required: true, options: opt(CUSTOM_FIELD_TYPES, CUSTOM_FIELD_TYPE_LABELS) },
    { key: "required", label: "Obrigatória", kind: "bool" },
    {
      key: "options",
      label: "Opções",
      kind: "text",
      wide: true,
      hint: `separadas por vírgula; obrigatório para os tipos ${OPTION_FIELD_TYPES.join(", ")}`,
    },
    { key: "helpText", label: "Texto de ajuda", kind: "text", wide: true },
  ],
  rules:
    "Propriedade = campo personalizado de projetos (PROJECT) ou tarefas (TASK). Se o usuário não disser o tipo, ou pedir uma seleção sem dizer as opções, pergunte antes de propor.",
  schema: customFieldDefinitionSchema,
  toInput: (v) => ({
    entity: v.entity,
    label: v.label,
    type: v.type,
    helpText: opt$(v.helpText),
    required: bool(v.required),
    options: OPTION_FIELD_TYPES.includes(v.type as CustomFieldType) ? parseOptionLabels(v.options ?? "") : [],
  }),
};

export const AI_ENTITIES: Record<AiEntityKey, AiEntityDef> = {
  demand,
  client,
  analyst,
  requester,
  department,
  demandType,
  tag,
  contract,
  project,
  projectTask,
  customField,
};
