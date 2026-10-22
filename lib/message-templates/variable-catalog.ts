import type { MessageTemplateEvent, MessageTemplateScope } from "./events";

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
  /** Template scopes that fill these variables — absent means every scope. */
  scopes?: MessageTemplateScope[];
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
    events: ["CONTRACT_USAGE", "BACKUP_FAILED", "SOAP_FAILED", "DEMAND_REPORT"],
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
      { key: "contractedHours", label: "Horas contratadas no mês (contrato + extras)", example: "50h" },
      { key: "baseHours", label: "Horas do contrato (sem extras)", example: "30h" },
      { key: "extraHours", label: "Horas extras lançadas no mês", example: "20h" },
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
    id: "report",
    label: "Relatório de demandas",
    events: ["DEMAND_REPORT"],
    fields: [
      { key: "periodLabel", label: "Período de referência", example: "outubro/2026" },
      { key: "periodStart", label: "Início do período", example: "01/10/2026" },
      { key: "periodEnd", label: "Fim do período", example: "31/10/2026" },
      { key: "periodSlug", label: "Período (para nome de arquivo)", example: "2026-10" },
      { key: "demandsCount", label: "Quantidade de demandas no período", example: "12" },
      { key: "totalHours", label: "Total de horas no período", example: "34,5h" },
      { key: "analystsNames", label: "Analistas que atenderam", example: "João Silva, Maria Souza" },
      { key: "executedHours", label: "Horas executadas (demandas concluídas)", example: "30h" },
      { key: "scheduledHours", label: "Horas programadas (demandas pendentes / em andamento)", example: "4,5h" },
      { key: "contractBaseHours", label: "Horas do contrato no mês (sem extras)", example: "40h" },
      { key: "contractExtraHours", label: "Horas extras lançadas no mês", example: "10h" },
      { key: "contractTotalHours", label: "Horas contratadas no mês (contrato + extras)", example: "50h" },
      { key: "contractUsagePercent", label: "Percentual usado (executadas ÷ contratadas)", example: "60%" },
      { key: "attachmentNames", label: "Nome(s) do(s) anexo(s)", example: "demandas-ITE - Toledo-2026-10.xlsx" },
    ],
  },
  {
    id: "allClients",
    label: "Todos os clientes (totais)",
    events: ["DEMAND_REPORT", "CONTRACT_USAGE"],
    scopes: ["ALL_CLIENTS"],
    fields: [
      { key: "clientsCount", label: "Quantidade de clientes no e-mail", example: "3" },
      { key: "grandDemandsCount", label: "Total de demandas (todos os clientes)", example: "27" },
      { key: "grandTotalHours", label: "Total de horas (todos os clientes)", example: "86,5h" },
      { key: "grandExecutedHours", label: "Total de horas executadas (relatório)", example: "72h" },
      { key: "grandScheduledHours", label: "Total de horas programadas (relatório)", example: "14,5h" },
      { key: "grandContractBaseHours", label: "Total de horas dos contratos (relatório)", example: "130h" },
      { key: "grandExtraHours", label: "Total de horas extras do mês (relatório)", example: "20h" },
      { key: "grandContractTotalHours", label: "Total de horas contratadas + extras (relatório)", example: "150h" },
      { key: "grandUsagePercent", label: "Percentual usado geral (relatório)", example: "48%" },
      { key: "grandContractedHours", label: "Total de horas contratadas (consumo)", example: "150h" },
      { key: "grandUsedHours", label: "Total de horas utilizadas (consumo)", example: "86,5h" },
      { key: "grandRemainingHours", label: "Saldo total de horas (consumo)", example: "63,5h" },
    ],
  },
  {
    id: "demand",
    label: "Demanda lançada",
    events: ["CONTRACT_USAGE"],
    scopes: ["PER_CLIENT"],
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

export function variableGroupsForEvent(event: MessageTemplateEvent, scope: MessageTemplateScope = "PER_CLIENT"): VariableGroup[] {
  return VARIABLE_CATALOG.filter(
    (g) => (g.events === "all" || g.events.includes(event)) && (!g.scopes || g.scopes.includes(scope))
  );
}

export function flattenVariables(groups: VariableGroup[] = VARIABLE_CATALOG): VariableField[] {
  const seen = new Set<string>();
  return groups.flatMap((g) => g.fields).filter((f) => (seen.has(f.key) ? false : (seen.add(f.key), true)));
}

/** `{ key: example }` for every variable — preview and test-send values. */
export function exampleVariables(): Record<string, string> {
  return Object.fromEntries(flattenVariables().map((f) => [f.key, f.example]));
}

/**
 * Sample clients for previewing ALL_CLIENTS templates — only the per-client values; the rest comes
 * from the email's own vars (fillTemplateHtml merges them).
 */
export function exampleClients(): Record<string, string>[] {
  return [
    { clientName: "ITE - Toledo", demandsCount: "12", totalHours: "34,5h", analystsNames: "João Silva, Maria Souza" },
    { clientName: "Colégio Horizonte", demandsCount: "9", totalHours: "28h", analystsNames: "João Silva" },
    { clientName: "Faculdade Vale Verde", demandsCount: "6", totalHours: "24h", analystsNames: "Ana Pereira" },
  ].map((client, i) => ({
    ...client,
    clientLegalName: `${client.clientName} Ltda.`,
    contractedHours: ["50h", "40h", "60h"][i],
    usedHours: client.totalHours,
    remainingHours: ["15,5h", "12h", "36h"][i],
    usagePercent: ["69%", "70%", "40%"][i],
    executedHours: ["30h", "28h", "20h"][i],
    scheduledHours: ["4,5h", "0h", "4h"][i],
    contractBaseHours: ["40h", "40h", "—"][i],
    contractExtraHours: ["10h", "0h", "—"][i],
    contractTotalHours: ["50h", "40h", "—"][i],
    contractUsagePercent: ["60%", "70%", "—"][i],
  }));
}
