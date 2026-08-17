export const MODULES = {
  DASHBOARD: { key: "dashboard", label: "Dashboard", icon: "LayoutDashboard", path: "/dashboard" },
  CLIENTS: { key: "clients", label: "Clientes", icon: "Building2", path: "/admin/clients" },
  TBCS: { key: "tbcs", label: "TBCs", icon: "Server", path: "/admin/tbcs" },
  FILTERS: { key: "filters", label: "Filtros", icon: "Filter", path: "/admin/filters" },
  DATASERVERS: { key: "dataservers", label: "Dataservers", icon: "Database", path: "/admin/dataservers" },
  PROCESSES: { key: "processes", label: "Processos", icon: "Workflow", path: "/admin/processes" },
  SENTENCE_CATEGORIES: { key: "sentence-categories", label: "Categorias Sentenças", icon: "FolderTree", path: "/admin/sentence-categories" },
  SENTENCES: { key: "sentences", label: "Sentenças", icon: "FileText", path: "/admin/sentences" },
  USERS: { key: "users", label: "Usuários", icon: "Users", path: "/admin/users" },
  SOAP: { key: "soap", label: "Integração SOAP", icon: "Radio", path: "/soap/builder" },
  SOAP_HISTORY: { key: "soap-history", label: "Histórico SOAP", icon: "History", path: "/soap/history" },
  SETTINGS: { key: "settings", label: "Configurações", icon: "Settings", path: "/settings" },
} as const;

export type ModuleKey = keyof typeof MODULES;
