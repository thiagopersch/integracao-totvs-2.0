import { cloneWithNewIds } from "./block-tree-utils";
import type { BlockTree } from "./block-types";
import type { MessageTemplateEvent, MessageTemplateScope } from "./events";

/**
 * Built-in templates per event: the fallback used when an organization has no active template for
 * an event, and the starting point offered by "Novo template".
 */
interface DefaultTemplate {
  subject: string;
  content: BlockTree;
  whatsapp: string;
}

const text = (id: string, html: string) => ({ id, name: id, type: "text" as const, props: { html } });

const DEFAULTS: Record<MessageTemplateEvent, DefaultTemplate> = {
  CONTRACT_USAGE: {
    subject: "[Atenção] Contrato {{clientName}} — consumo de {{usagePercent}} das horas de {{periodLabel}}",
    content: [
      text("text1", "<h2>Consumo de horas do contrato</h2><p>Olá, <strong>{{recipientName}}</strong>.</p>"),
      text(
        "text2",
        "<p>Informamos que o consumo de horas do contrato de <strong>{{clientName}}</strong> referente a <strong>{{periodLabel}}</strong> está em <strong>{{usagePercent}} de 100%</strong> das horas contratadas no mês.</p>"
      ),
      {
        id: "table1",
        name: "table1",
        type: "table",
        props: {
          hasHeader: true,
          cells: [
            ["Resumo do mês", "Horas"],
            ["Horas contratadas", "{{contractedHours}}"],
            ["Horas do contrato + extras do mês", "{{baseHours}} + {{extraHours}}"],
            ["Horas utilizadas", "{{usedHours}}"],
            ["Saldo restante", "{{remainingHours}}"],
            ["Horas excedentes", "{{exceededHours}}"],
            ["Consumo", "{{usagePercent}}"],
          ],
        },
      },
      {
        id: "container1",
        name: "container1",
        type: "container",
        props: {
          marginY: 8,
          marginX: 0,
          paddingY: 12,
          paddingX: 16,
          backgroundColor: "#fef2f2",
          borderColor: "#fecaca",
          borderRadius: 6,
          visibleIf: "isExceeded",
        },
        children: [
          text(
            "text3",
            "<p><strong>As horas contratadas do mês foram excedidas.</strong> As horas adicionais serão tratadas conforme o contrato.</p>"
          ),
        ],
      },
      { id: "divider1", name: "divider1", type: "divider", props: { color: "#e2e8f0", thickness: 1, marginY: 16 } },
      text("text4", '<p style="color:#6b7280;font-size:13px">Este é um aviso automático. Em caso de dúvidas, responda este e-mail.</p>'),
    ],
    whatsapp:
      "*Consumo de horas do contrato*\n\nOlá, {{recipientName}}!\nO contrato de *{{clientName}}* está em *{{usagePercent}} de 100%* das horas de {{periodLabel}}.\n\nContratadas: {{contractedHours}}\nUtilizadas: {{usedHours}}\nSaldo: {{remainingHours}}",
  },
  BACKUP_FAILED: {
    subject: "Falha no backup — {{filterLabel}}",
    content: [
      text("text1", "<h2>Falha no backup</h2><p>{{message}}</p>"),
      {
        id: "table1",
        name: "table1",
        type: "table",
        props: {
          hasHeader: false,
          cells: [
            ["Cliente", "{{clientName}}"],
            ["TBC", "{{tbcName}}"],
            ["Tipo de erro", "{{errorKind}}"],
            ["Erro", "{{errorMessage}}"],
          ],
        },
      },
      {
        id: "button1",
        name: "button1",
        type: "button",
        props: {
          label: "Abrir no sistema",
          href: "/notifications",
          linkType: "app",
          bgColor: "#16a34a",
          textColor: "#ffffff",
          radius: 6,
          paddingY: 10,
          paddingX: 20,
          align: "left",
        },
      },
    ],
    whatsapp: "*Falha no backup*\n{{message}}\n\nTBC: {{tbcName}}\nErro: {{errorMessage}}",
  },
  SOAP_FAILED: {
    subject: "Falha na chamada SOAP — {{method}}",
    content: [
      text("text1", "<h2>Falha na chamada SOAP</h2><p>{{message}}</p>"),
      {
        id: "table1",
        name: "table1",
        type: "table",
        props: {
          hasHeader: false,
          cells: [
            ["Cliente", "{{clientName}}"],
            ["Origem", "{{sourceLabel}}"],
            ["Método", "{{method}} ({{wsName}})"],
            ["Tipo de erro", "{{errorKind}}"],
            ["Erro", "{{errorMessage}}"],
          ],
        },
      },
    ],
    whatsapp: "*Falha na chamada SOAP*\n{{message}}\n\nMétodo: {{method}}\nErro: {{errorMessage}}",
  },
  DEMAND_REPORT: {
    subject: "Relatório de demandas — {{clientName}} — {{periodLabel}}",
    content: [
      text(
        "text1",
        "<h2>Relatório de demandas</h2><p>Olá,</p><p>Segue em anexo a planilha com as demandas atendidas para <strong>{{clientName}}</strong> referentes a <strong>{{periodLabel}}</strong> ({{periodStart}} a {{periodEnd}}).</p>"
      ),
      {
        id: "table1",
        name: "table1",
        type: "table",
        props: {
          hasHeader: true,
          cells: [
            ["Resumo do período", ""],
            ["Demandas lançadas", "{{demandsCount}}"],
            ["Horas executadas", "{{totalHours}}"],
            ["Analistas", "{{analystsNames}}"],
          ],
        },
      },
      { id: "divider1", name: "divider1", type: "divider", props: { color: "#e2e8f0", thickness: 1, marginY: 16 } },
      text("text2", '<p style="color:#6b7280;font-size:13px">Este é um envio automático. Em caso de dúvidas, responda este e-mail.</p>'),
    ],
    whatsapp: "*Relatório de demandas*\n{{clientName}} — {{periodLabel}}\n\nDemandas: {{demandsCount}}\nHoras: {{totalHours}}",
  },
  GENERAL: {
    subject: "{{title}}",
    content: [text("text1", "<h2>{{title}}</h2><p>{{message}}</p>")],
    whatsapp: "*{{title}}*\n{{message}}",
  },
};

const repeatContainer = (id: string, children: BlockTree) => ({
  id,
  name: id,
  type: "container" as const,
  props: {
    marginY: 8,
    marginX: 0,
    paddingY: 4,
    paddingX: 0,
    backgroundColor: "transparent",
    repeatPerClient: true,
  },
  children: children as never,
});

/** ALL_CLIENTS versions: one email, a container repeated per client (one table under the other). */
const ALL_CLIENTS_DEFAULTS: Partial<Record<MessageTemplateEvent, DefaultTemplate>> = {
  DEMAND_REPORT: {
    subject: "Relatório de demandas — todos os clientes — {{periodLabel}}",
    content: [
      text(
        "text1",
        "<h2>Relatório de demandas</h2><p>Olá,</p><p>Segue o resumo das demandas atendidas referentes a <strong>{{periodLabel}}</strong> ({{periodStart}} a {{periodEnd}}): <strong>{{clientsCount}}</strong> cliente(s), <strong>{{grandDemandsCount}}</strong> demanda(s) e <strong>{{grandTotalHours}}</strong> no total. A planilha em anexo traz uma aba de resumo e uma aba por cliente.</p>"
      ),
      repeatContainer("container1", [
        text("text2", "<h3>{{clientName}}</h3>"),
        {
          id: "table1",
          name: "table1",
          type: "table",
          props: {
            hasHeader: true,
            cells: [
              ["Resumo do período", ""],
              ["Demandas lançadas", "{{demandsCount}}"],
              ["Horas executadas", "{{totalHours}}"],
              ["Analistas", "{{analystsNames}}"],
            ],
          },
        },
      ]),
      { id: "divider1", name: "divider1", type: "divider", props: { color: "#e2e8f0", thickness: 1, marginY: 16 } },
      text("text3", '<p style="color:#6b7280;font-size:13px">Este é um envio automático. Em caso de dúvidas, responda este e-mail.</p>'),
    ],
    whatsapp: "",
  },
  CONTRACT_USAGE: {
    subject: "Consumo de horas dos contratos — {{periodLabel}}",
    content: [
      text(
        "text1",
        "<h2>Consumo de horas dos contratos</h2><p>Olá,</p><p>Segue o consumo de horas de <strong>{{clientsCount}}</strong> cliente(s) referente a <strong>{{periodLabel}}</strong>: <strong>{{grandUsedHours}}</strong> utilizadas de <strong>{{grandContractedHours}}</strong> contratadas. A planilha em anexo traz os mesmos números.</p>"
      ),
      repeatContainer("container1", [
        text("text2", "<h3>{{clientName}}</h3>"),
        {
          id: "table1",
          name: "table1",
          type: "table",
          props: {
            hasHeader: true,
            cells: [
              ["Resumo do mês", "Horas"],
              ["Horas contratadas", "{{contractedHours}}"],
              ["Horas do contrato + extras do mês", "{{baseHours}} + {{extraHours}}"],
              ["Horas utilizadas", "{{usedHours}}"],
              ["Saldo restante", "{{remainingHours}}"],
              ["Horas excedentes", "{{exceededHours}}"],
              ["Consumo", "{{usagePercent}} ({{usageLevel}})"],
            ],
          },
        },
      ]),
      { id: "divider1", name: "divider1", type: "divider", props: { color: "#e2e8f0", thickness: 1, marginY: 16 } },
      text("text3", '<p style="color:#6b7280;font-size:13px">Este é um envio automático. Em caso de dúvidas, responda este e-mail.</p>'),
    ],
    whatsapp: "",
  },
};

/** A fresh copy (new block ids) of the built-in template for an event (and scope). */
export function defaultTemplate(event: MessageTemplateEvent, scope: MessageTemplateScope = "PER_CLIENT"): DefaultTemplate {
  const d = (scope === "ALL_CLIENTS" && ALL_CLIENTS_DEFAULTS[event]) || DEFAULTS[event];
  return { subject: d.subject, whatsapp: d.whatsapp, content: cloneWithNewIds(d.content) };
}
