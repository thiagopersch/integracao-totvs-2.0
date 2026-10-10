import type { MessageTemplateEvent } from "./events";

export interface VariableField {
  key: string;
  label: string;
  /** Sample value used by the preview ("Dados de exemplo") and by test sends. */
  example: string;
}

export interface VariableGroup {
  id: string;
  label: string;
  /** Events whose sends fill these variables — the picker shows only the groups of the selected event. */
  events: MessageTemplateEvent[] | "all";
  fields: VariableField[];
}

/**
 * Every `{{key}}` a template can use. Keys are flat (`\w+`) and must match what
 * lib/message-templates/vars-builder.ts (and message-render.service's base vars) produce at send
 * time — never rename an existing key, saved templates reference them.
 */
export const VARIABLE_CATALOG: VariableGroup[] = [
  {
    id: "recipient",
    label: "Destinatário",
    events: "all",
    fields: [
      { key: "recipientName", label: "Nome do destinatário", example: "Maria Souza" },
      { key: "recipientEmail", label: "E-mail do destinatário", example: "contato@cliente.com.br" },
    ],
  },
  {
    id: "organization",
    label: "Organização",
    events: "all",
    fields: [
      { key: "organizationName", label: "Nome da organização", example: "PerschTech" },
      { key: "organizationDocument", label: "CNPJ da organização", example: "12.345.678/0001-90" },
    ],
  },
  {
    id: "client",
    label: "Cliente",
    events: ["CONTRACT_USAGE", "BACKUP_FAILED", "SOAP_FAILED"],
    fields: [
      { key: "clientName", label: "Nome", example: "ITE - Toledo" },
      { key: "clientLegalName", label: "Razão social", example: "ITE Toledo Ltda." },
      { key: "clientDocument", label: "CNPJ / Documento", example: "98.765.432/0001-10" },
      { key: "clientEmail", label: "E-mail", example: "contato@cliente.com.br" },
      { key: "clientPhone", label: "Telefone", example: "(45) 99999-0000" },
      { key: "clientResponsible", label: "Responsável", example: "Maria Souza" },
      { key: "clientSite", label: "Site", example: "https://cliente.com.br" },
      { key: "clientCrmLink", label: "Link do CRM", example: "https://crm.exemplo.com/clientes/123" },
    ],
  },
  {
    id: "contract",
    label: "Contrato / Consumo",
    events: ["CONTRACT_USAGE"],
    fields: [
      { key: "periodLabel", label: "Mês de referência", example: "outubro/2026" },
      { key: "contractedHours", label: "Horas contratadas no mês", example: "40h" },
      { key: "usedHours", label: "Horas utilizadas no mês", example: "34h" },
      { key: "remainingHours", label: "Saldo de horas", example: "6h" },
      { key: "exceededHours", label: "Horas excedentes", example: "0h" },
      { key: "usagePercent", label: "Percentual consumido", example: "85%" },
      { key: "remainingPercent", label: "Percentual restante", example: "15%" },
      { key: "usageLevel", label: "Situação (Normal/Atenção/Crítico/Excedido)", example: "Atenção" },
      { key: "demandsCount", label: "Demandas lançadas no mês", example: "12" },
      { key: "hourlyRate", label: "Valor médio da hora (analistas)", example: "R$ 150,00" },
      { key: "contractedValue", label: "Valor contratado no mês", example: "R$ 6.000,00" },
      { key: "usedValue", label: "Valor consumido no mês (horas × valor/hora do analista)", example: "R$ 5.100,00" },
      { key: "contractStartDate", label: "Início do contrato", example: "01/10/2026" },
      { key: "contractEndDate", label: "Término do contrato", example: "Indeterminado" },
      { key: "contractStatus", label: "Status do contrato", example: "Ativo" },
      { key: "contractNotes", label: "Observações do contrato", example: "Atendimento remoto" },
      { key: "isExceeded", label: "Excedeu as horas (sim / vazio)", example: "" },
    ],
  },
  {
    id: "demand",
    label: "Demanda lançada",
    events: ["CONTRACT_USAGE"],
    fields: [
      { key: "demandName", label: "Título", example: "Ajuste na fórmula de cálculo" },
      { key: "demandDescription", label: "Descrição", example: "Correção da fórmula visual do processo de matrícula." },
      { key: "demandDate", label: "Data", example: "02/10/2026" },
      { key: "demandStartTime", label: "Hora de início", example: "08:00" },
      { key: "demandEndTime", label: "Hora de término", example: "10:30" },
      { key: "demandHours", label: "Horas da demanda", example: "2,5h" },
      { key: "demandStatus", label: "Status", example: "Concluída" },
      { key: "demandPriority", label: "Prioridade", example: "Alta" },
      { key: "demandType", label: "Tipo de demanda", example: "Suporte" },
      { key: "demandDepartment", label: "Departamento", example: "Secretaria Acadêmica" },
      { key: "demandAnalystName", label: "Analista", example: "João Silva" },
      { key: "demandAnalystEmail", label: "E-mail do analista", example: "joao@perschtech.com.br" },
      { key: "demandRequesterName", label: "Solicitante", example: "Ana Pereira" },
      { key: "demandRequesterEmail", label: "E-mail do solicitante", example: "ana@cliente.com.br" },
    ],
  },
  {
    id: "failure",
    label: "Falhas",
    events: ["BACKUP_FAILED", "SOAP_FAILED"],
    fields: [
      { key: "errorMessage", label: "Mensagem de erro", example: "connect ETIMEDOUT 10.0.0.1:8051" },
      { key: "errorKind", label: "Tipo de erro", example: "Tempo esgotado (timeout)" },
      { key: "failureDate", label: "Data e hora da falha", example: "02/10/2026 14:35" },
      { key: "sourceLabel", label: "Origem", example: "Filtro para backup" },
      { key: "tbcName", label: "TBC", example: "TBC Produção" },
      { key: "tbcLink", label: "Endereço do TBC", example: "https://tbc.cliente.com.br:8051" },
      { key: "method", label: "Método SOAP", example: "ReadView" },
      { key: "wsName", label: "Web service", example: "wsDataServer" },
      { key: "filterLabel", label: "Filtro para backup", example: "Cliente X | TBC Produção | Sentenças RH" },
    ],
  },
  {
    id: "general",
    label: "Geral",
    events: "all",
    fields: [
      { key: "title", label: "Título da notificação", example: "Contrato em atenção — ITE - Toledo (85%)" },
      { key: "message", label: "Mensagem da notificação", example: "O consumo de horas do contrato atingiu 85%." },
      { key: "appUrl", label: "Endereço do sistema", example: "https://app.exemplo.com.br" },
      { key: "currentDate", label: "Data atual", example: "02/10/2026" },
      { key: "currentDateTime", label: "Data e hora atual", example: "02/10/2026 14:35" },
      { key: "currentMonth", label: "Mês atual", example: "outubro/2026" },
    ],
  },
];

export function variableGroupsForEvent(event: MessageTemplateEvent): VariableGroup[] {
  return VARIABLE_CATALOG.filter((g) => g.events === "all" || g.events.includes(event));
}

export function flattenVariables(groups: VariableGroup[] = VARIABLE_CATALOG): VariableField[] {
  const seen = new Set<string>();
  return groups.flatMap((g) => g.fields).filter((f) => (seen.has(f.key) ? false : (seen.add(f.key), true)));
}

/** `{ key: example }` for every variable — preview and test-send values. */
export function exampleVariables(): Record<string, string> {
  return Object.fromEntries(flattenVariables().map((f) => [f.key, f.example]));
}
