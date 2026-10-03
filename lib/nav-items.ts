import { hasPermission } from "@/lib/permissions";

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
  /** Sidebar section heading this group is listed under (e.g. "TOTVS RM"); omitted = no heading. */
  section?: string;
  /** Render as a collapsible group even with a single item (default: single-item groups render as a flat link). */
  forceCollapsible?: boolean;
};

/**
 * Sidebar structure: sections (headings) → groups (collapses) → routes. Only the grouping lives
 * here — routes/permissions are unchanged, and route gating (proxy.ts → findNavItemByPathname)
 * works off the flattened items, so regrouping never affects access control.
 */
export const navGroups: NavGroup[] = [
  {
    label: "Geral",
    icon: "LayoutDashboard",
    items: [{ href: "/dashboard", label: "Dashboard", icon: "LayoutDashboard", resource: "dashboard", action: "view" }],
  },

  // ── Operação ────────────────────────────────────────────────────────────────
  {
    section: "Operação",
    label: "Demandas",
    icon: "ListChecks",
    items: [
      { href: "/demands", label: "Demandas", icon: "ListChecks", resource: "demands" },
      { href: "/contracts", label: "Contratos", icon: "FileSignature", resource: "contracts" },
    ],
  },
  {
    section: "Operação",
    label: "Projetos",
    icon: "FolderKanban",
    forceCollapsible: true,
    items: [
      { href: "/projetos/mapeador", label: "Mapeador", icon: "Map", resource: "mapeador_projetos", action: "read" },
    ],
  },

  // ── Cadastros ───────────────────────────────────────────────────────────────
  {
    section: "Cadastros",
    label: "Clientes",
    icon: "Building2",
    items: [{ href: "/admin/clients", label: "Clientes", icon: "Building2", resource: "clients" }],
  },
  {
    section: "Cadastros",
    label: "Equipe",
    icon: "Users2",
    items: [
      { href: "/analysts", label: "Analistas", icon: "UserCog", resource: "analysts" },
      { href: "/requesters", label: "Solicitantes", icon: "UserPlus", resource: "requesters" },
      { href: "/departments", label: "Departamentos", icon: "Building", resource: "departments" },
    ],
  },
  {
    section: "Cadastros",
    label: "Classificação",
    icon: "Tags",
    items: [
      { href: "/demand-types", label: "Tipos de Demanda", icon: "Tags", resource: "demand_types" },
      { href: "/tags", label: "Tags", icon: "Tag", resource: "tags" },
    ],
  },

  // ── TOTVS RM ────────────────────────────────────────────────────────────────
  {
    section: "TOTVS RM",
    label: "Conexões",
    icon: "Server",
    items: [
      { href: "/admin/tbcs", label: "TBCs", icon: "Server", resource: "tbcs" },
      { href: "/admin/filters", label: "Filtros", icon: "Filter", resource: "filters" },
    ],
  },
  {
    section: "TOTVS RM",
    label: "Sentenças",
    icon: "FileText",
    items: [
      { href: "/admin/sentence-categories", label: "Categorias de Sentenças", icon: "FolderTree", resource: "sentence_categories" },
      { href: "/admin/sentences", label: "Sentenças Padrões", icon: "FileText", resource: "sentences" },
    ],
  },
  {
    section: "TOTVS RM",
    label: "Catálogo RM",
    icon: "Database",
    items: [
      { href: "/admin/dataservers", label: "Dataservers", icon: "Database", resource: "dataservers" },
      { href: "/admin/processes", label: "Processos", icon: "Workflow", resource: "processes" },
      { href: "/admin/sistemas", label: "Sistemas TOTVS", icon: "Layers", resource: "sistemas" },
    ],
  },
  {
    section: "TOTVS RM",
    label: "SOAP",
    icon: "Radio",
    items: [
      { href: "/soap/builder", label: "Integração SOAP", icon: "Radio", resource: "soap", action: "execute" },
      { href: "/admin/soap-endpoints", label: "Endpoints SOAP", icon: "Settings", resource: "settings", action: "manage" },
    ],
  },
  {
    section: "TOTVS RM",
    label: "Relatórios TBC",
    icon: "FileBarChart",
    items: [
      { href: "/integrations/tbc-reports", label: "Relatórios TBC", icon: "FileBarChart", resource: "tbc_reports", action: "execute" },
    ],
  },

  // ── Rubeus ──────────────────────────────────────────────────────────────────
  {
    section: "Rubeus",
    label: "Inscrições e matrículas",
    icon: "GraduationCap",
    forceCollapsible: true,
    items: [
      { href: "/integrations/ps-docs", label: "Documentação PS", icon: "FileText", resource: "ps_docs", action: "execute" },
      { href: "/integrations/ps-ficha-test", label: "Teste de Ficha PS", icon: "FlaskConical", resource: "ps_ficha_test", action: "execute" },
    ],
  },

  // ── Integrações ─────────────────────────────────────────────────────────────
  {
    section: "Integrações",
    label: "APIs externas",
    icon: "Plug",
    items: [
      { href: "/integrations/tpi", label: "TPI TOTVS", icon: "Landmark", resource: "integrations", action: "execute" },
      { href: "/integrations/cielo", label: "Cielo", icon: "CreditCard", resource: "integrations", action: "execute" },
    ],
  },
  {
    section: "Integrações",
    label: "Comunicação",
    icon: "MessageSquareText",
    items: [
      { href: "/integrations/email", label: "E-mail (SMTP)", icon: "Mail", resource: "integrations", action: "execute" },
      { href: "/integrations/message-templates", label: "Templates de Mensagem", icon: "MessageSquareText", resource: "message_templates", action: "read" },
    ],
  },

  // ── Administração ───────────────────────────────────────────────────────────
  {
    section: "Administração",
    label: "Acesso",
    icon: "ShieldCheck",
    items: [
      { href: "/admin/users", label: "Usuários", icon: "Users", resource: "users" },
      { href: "/admin/roles", label: "Papéis e Permissões", icon: "ShieldCheck", resource: "roles" },
    ],
  },
  {
    section: "Administração",
    label: "Rastreamento de Atividades",
    icon: "Activity",
    items: [{ href: "/admin/activity", label: "Rastreamento de Atividades", icon: "Activity", resource: null }],
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

/** First nav route this permission set can actually open — used to land a user somewhere
 *  meaningful (e.g. after a forced password reset) instead of assuming `/dashboard`. */
export function getFirstAllowedRoute(permissions: string[]): string {
  const allowed = flattenNavItems().find((item) => !item.resource || hasPermission(permissions, item.resource, item.action || "read"));
  return allowed?.href ?? "/dashboard";
}
