export type NavLeaf = {
  href: string;
  label: string;
  icon: string;
  resource: string | null;
  action?: string;
  superAdminOnly?: boolean;
};

export type NavGroup = {
  label: string;
  icon: string;
  items: NavLeaf[];
};

export const navGroups: NavGroup[] = [
  {
    label: "Geral",
    icon: "LayoutDashboard",
    items: [{ href: "/dashboard", label: "Dashboard", icon: "LayoutDashboard", resource: "dashboard", action: "view" }],
  },
  {
    label: "TOTVS RM",
    icon: "Building2",
    items: [
      { href: "/admin/clients", label: "Clientes", icon: "Building2", resource: "clients" },
      { href: "/admin/tbcs", label: "TBCs", icon: "Server", resource: "tbcs" },
      { href: "/admin/filters", label: "Filtros", icon: "Filter", resource: "filters" },
      { href: "/admin/sentence-categories", label: "Categorias Sentenças", icon: "FolderTree", resource: "sentence_categories" },
      { href: "/admin/sentences", label: "Sentenças Padrões", icon: "FileText", resource: "sentences" },
      { href: "/admin/dataservers", label: "Dataservers", icon: "Database", resource: "dataservers" },
      { href: "/admin/processes", label: "Processos", icon: "Workflow", resource: "processes" },
      { href: "/admin/sistemas", label: "Sistemas TOTVS", icon: "Layers", resource: "sistemas" },
    ],
  },
  {
    label: "SOAP",
    icon: "Radio",
    items: [
      { href: "/soap/builder", label: "Integração SOAP", icon: "Radio", resource: "soap", action: "execute" },
      { href: "/soap/history", label: "Histórico SOAP", icon: "History", resource: "soap", action: "history" },
      { href: "/admin/soap-endpoints", label: "Endpoints SOAP", icon: "Settings", resource: "settings", action: "manage" },
    ],
  },
  {
    label: "Integrações",
    icon: "Plug",
    items: [
      { href: "/integrations/tpi", label: "TPI TOTVS", icon: "Landmark", resource: "integrations", action: "execute" },
      { href: "/integrations/cielo", label: "Cielo", icon: "CreditCard", resource: "integrations", action: "execute" },
      { href: "/integrations/email", label: "E-mail", icon: "Mail", resource: "integrations", action: "execute" },
      { href: "/integrations/tbc-reports", label: "Relatórios TBC", icon: "FileBarChart", resource: "tbc_reports", action: "execute" },
    ],
  },
  {
    label: "Demandas",
    icon: "ListChecks",
    items: [
      { href: "/demands", label: "Demandas", icon: "ListChecks", resource: "demands" },
      { href: "/analysts", label: "Analistas", icon: "UserCog", resource: "analysts" },
      { href: "/contracts", label: "Contratos", icon: "FileSignature", resource: "contracts" },
      { href: "/requesters", label: "Solicitantes", icon: "UserPlus", resource: "requesters" },
      { href: "/departments", label: "Departamentos", icon: "Building", resource: "departments" },
      { href: "/demand-types", label: "Tipos de Demanda", icon: "Tags", resource: "demand_types" },
      { href: "/tags", label: "Tags", icon: "Tag", resource: "tags" },
    ],
  },
  {
    label: "Administração",
    icon: "ShieldCheck",
    items: [
      { href: "/admin/users", label: "Usuários", icon: "Users", resource: "users" },
      { href: "/admin/roles", label: "Papéis e Permissões", icon: "ShieldCheck", resource: "roles" },
      { href: "/admin/deletion-logs", label: "Logs de Exclusão", icon: "AlertTriangle", resource: "deletion_logs" },
    ],
  },
  {
    label: "Conta",
    icon: "UserCircle",
    items: [
      { href: "/notifications", label: "Notificações", icon: "Bell", resource: null },
      { href: "/profile", label: "Perfil", icon: "UserCircle", resource: null },
    ],
  },
];

export function flattenNavItems(): NavLeaf[] {
  return navGroups.flatMap((g) => g.items);
}

export function findNavItemByPathname(pathname: string): NavLeaf | undefined {
  const items = flattenNavItems();
  const exact = items.find((i) => i.href === pathname);
  if (exact) return exact;
  return items.filter((i) => pathname.startsWith(i.href + "/")).sort((a, b) => b.href.length - a.href.length)[0];
}
