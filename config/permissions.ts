export type PermissionDef = {
  resource: string;
  action: string;
  name: string;
  description: string;
  module: string;
};

const crud = (resource: string, label: string, module: string): PermissionDef[] => [
  { resource, action: "read", name: `Listar ${label}`, description: `Visualizar lista de ${label.toLowerCase()}`, module },
  { resource, action: "create", name: `Criar ${label}`, description: `Criar novos ${label.toLowerCase()}`, module },
  { resource, action: "update", name: `Atualizar ${label}`, description: `Editar ${label.toLowerCase()}`, module },
  { resource, action: "delete", name: `Excluir ${label}`, description: `Excluir ${label.toLowerCase()}`, module },
];

export const PERMISSIONS: PermissionDef[] = [
  ...crud("users", "Usuários", "users"),
  ...crud("roles", "Papéis e Permissões", "users"),
  ...crud("dataservers", "Dataservers", "totvs"),
  ...crud("processes", "Processos", "totvs"),
  ...crud("clients", "Clientes", "totvs"),
  ...crud("tbcs", "TBCs", "totvs"),
  ...crud("filters", "Filtros", "totvs"),
  ...crud("backups", "Backups", "totvs"),
  { resource: "backups", action: "restore", name: "Restaurar Backup", description: "Restaurar sentenças de backup para o TBC de destino no TOTVS RM", module: "totvs" },
  ...crud("sentence_categories", "Categorias de Sentença", "totvs"),
  ...crud("sentences", "Sentenças Padrões", "totvs"),
  ...crud("sistemas", "Sistemas TOTVS", "totvs"),
  ...crud("analysts", "Analistas", "demands"),
  ...crud("contracts", "Contratos", "demands"),
  ...crud("requesters", "Solicitantes", "demands"),
  ...crud("departments", "Departamentos", "demands"),
  ...crud("demand_types", "Tipos de Demanda", "demands"),
  ...crud("tags", "Tags", "demands"),
  ...crud("demands", "Demandas", "demands"),
  { resource: "soap", action: "execute", name: "Executar SOAP", description: "Executar chamadas SOAP", module: "soap" },
  { resource: "soap", action: "history", name: "Ver Histórico", description: "Visualizar histórico SOAP", module: "soap" },
  {
    resource: "integrations",
    action: "execute",
    name: "Executar Integrações Externas",
    description: "Testar conexões de integrações externas (TPI, Cielo, etc.)",
    module: "integrations",
  },
  {
    resource: "tbc_reports",
    action: "execute",
    name: "Executar Relatórios TBC",
    description: "Gerar e baixar relatórios TOTVS via TBC Web Services Reports",
    module: "integrations",
  },
  { resource: "dashboard", action: "view", name: "Ver Dashboard", description: "Visualizar dashboard", module: "dashboard" },
  { resource: "settings", action: "manage", name: "Gerenciar Configurações", description: "Gerenciar configurações do sistema", module: "settings" },
  { resource: "notifications", action: "read", name: "Ver Notificações", description: "Visualizar próprias notificações", module: "notifications" },
  { resource: "reports", action: "read", name: "Ver Relatórios", description: "Visualizar e exportar relatórios", module: "demands" },
  {
    resource: "deletion_logs",
    action: "read",
    name: "Ver Logs de Exclusão",
    description: "Visualizar registros que não puderam ser excluídos por estarem vinculados a outros cadastros",
    module: "settings",
  },
];

function toKey(p: Pick<PermissionDef, "resource" | "action">): string {
  return `${p.resource}:${p.action}`;
}

export const DEFAULT_ROLE_PERMISSIONS: Record<"ADMIN" | "MANAGER" | "USER", string[]> = {
  ADMIN: PERMISSIONS.map(toKey),
  MANAGER: PERMISSIONS.filter((p) =>
    ["clients", "tbcs", "filters", "backups", "sentence_categories", "sentences", "sistemas"].includes(p.resource)
      ? p.action !== "delete"
      : ["dataservers", "processes"].includes(p.resource)
        ? p.action === "read"
        : ["soap", "integrations", "tbc_reports", "dashboard", "notifications", "reports", "deletion_logs"].includes(p.resource)
          ? true
          : ["analysts", "contracts", "requesters", "departments", "demand_types", "tags", "demands"].includes(p.resource)
            ? p.action !== "delete"
            : false
  ).map(toKey),
  USER: PERMISSIONS.filter((p) =>
    p.action === "read" ||
    (p.resource === "soap" && (p.action === "execute" || p.action === "history")) ||
    (p.resource === "dashboard" && p.action === "view") ||
    (p.resource === "notifications" && p.action === "read") ||
    (p.resource === "demands" && p.action !== "delete")
  ).map(toKey),
};
