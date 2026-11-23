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
 * Sidebar structure: sections (headings) → groups (collapses) → routes. Each section owns a URL
 * prefix (/operations, /registry, /totvs, /rubeus, /integrations, /admin); old URLs are redirected
 * in next.config.ts (LEGACY_ROUTES). Route gating (proxy.ts → findNavItemByPathname)
 * works off the flattened items, so regrouping never affects access control.
 */
export const navGroups: NavGroup[] = [
  {
    label: "Geral",
    icon: "LayoutDashboard",
    items: [{ href: "/dashboard", label: "Dashboard", icon: "LayoutDashboard", resource: "dashboard", action: "view" }],
  },

  // ── Operação (/operations) ──────────────────────────────────────────────────
  {
    section: "Operação",
    label: "Demandas",
    icon: "ListChecks",
    items: [{ href: "/operations/demands", label: "Demandas", icon: "ListChecks", resource: "demands" }],
  },
  {
    section: "Operação",
    label: "Contratos",
    icon: "FileSignature",
    items: [{ href: "/operations/contracts", label: "Contratos", icon: "FileSignature", resource: "contracts" }],
  },
  {
    section: "Operação",
    label: "Projetos",
    icon: "FolderKanban",
    forceCollapsible: true,
    items: [
      { href: "/operations/projects", label: "Gestão de Projetos", icon: "SquareKanban", resource: "projects", action: "read" },
      { href: "/operations/projects/properties", label: "Propriedades", icon: "SlidersHorizontal", resource: "project_custom_fields", action: "read" },
      { href: "/operations/projects/mapper", label: "Mapeador", icon: "Map", resource: "mapeador_projetos", action: "read" },
    ],
  },

  // ── Cadastros (/registry) ───────────────────────────────────────────────────
  {
    section: "Cadastros",
    label: "Clientes",
    icon: "Building2",
    items: [{ href: "/registry/clients", label: "Clientes", icon: "Building2", resource: "clients" }],
  },
  {
    section: "Cadastros",
    label: "Equipe",
    icon: "Users2",
    items: [
      { href: "/registry/analysts", label: "Analistas", icon: "UserCog", resource: "analysts" },
      { href: "/registry/requesters", label: "Solicitantes", icon: "UserPlus", resource: "requesters" },
      { href: "/registry/departments", label: "Setores", icon: "Building", resource: "departments" },
    ],
  },
  {
    section: "Cadastros",
    label: "Classificação",
    icon: "Tags",
    items: [
      { href: "/registry/demand-types", label: "Tipos de Demanda", icon: "Tags", resource: "demand_types" },
      { href: "/registry/tags", label: "Tags", icon: "Tag", resource: "tags" },
    ],
  },

  // ── TOTVS RM (/totvs) ───────────────────────────────────────────────────────
  {
    section: "TOTVS RM",
    label: "Conexões TBC",
    icon: "Server",
    forceCollapsible: true,
    items: [
      { href: "/totvs/tbcs", label: "TBCs", icon: "Server", resource: "tbcs" },
      { href: "/totvs/backups", label: "Backups de sentenças", icon: "Filter", resource: "filters" },
      { href: "/totvs/reports", label: "Relatórios TBC", icon: "FileBarChart", resource: "tbc_reports", action: "execute" },
    ],
  },
  {
    section: "TOTVS RM",
    label: "Sentenças",
    icon: "FileText",
    items: [
      { href: "/totvs/sentences", label: "Sentenças padrões", icon: "FileText", resource: "sentences" },
      { href: "/totvs/sentence-categories", label: "Categorias", icon: "FolderTree", resource: "sentence_categories" },
    ],
  },
  {
    section: "TOTVS RM",
    label: "Catálogo RM",
    icon: "Database",
    items: [
      { href: "/totvs/dataservers", label: "Dataservers", icon: "Database", resource: "dataservers" },
      { href: "/totvs/processes", label: "Processos", icon: "Workflow", resource: "processes" },
      { href: "/totvs/systems", label: "Sistemas TOTVS", icon: "Layers", resource: "sistemas" },
    ],
  },
  {
    section: "TOTVS RM",
    label: "SOAP",
    icon: "Radio",
    items: [
      { href: "/totvs/soap/builder", label: "Construtor SOAP", icon: "Radio", resource: "soap", action: "execute" },
      { href: "/totvs/soap/favorites", label: "Favoritos", icon: "Star", resource: "soap", action: "execute" },
      { href: "/totvs/soap/templates", label: "Templates SOAP", icon: "FileCode", resource: "soap", action: "execute" },
      { href: "/totvs/soap/endpoints", label: "Endpoints", icon: "Settings", resource: "settings", action: "manage" },
    ],
  },

  // ── Rubeus (/rubeus) ────────────────────────────────────────────────────────
  {
    section: "Rubeus",
    label: "Inscrições e matrículas",
    icon: "GraduationCap",
    forceCollapsible: true,
    items: [
      { href: "/rubeus/docs", label: "Gerar documentação", icon: "FileText", resource: "ps_docs", action: "execute" },
      { href: "/rubeus/sql-docs", label: "Documentar consultas", icon: "Database", resource: "sql_docs", action: "execute" },
      { href: "/rubeus/logic-docs", label: "Trilhas de lógica", icon: "GitBranch", resource: "ps_docs", action: "execute" },
      { href: "/rubeus/field-search", label: "Buscar elementos", icon: "SearchCode", resource: "ps_field_search", action: "execute" },
      { href: "/rubeus/form-tests", label: "Testes automatizados", icon: "FlaskConical", resource: "ps_ficha_test", action: "execute" },
    ],
  },

  // ── Integrações (/integrations) ─────────────────────────────────────────────
  {
    section: "Integrações",
    label: "APIs externas",
    icon: "Plug",
    items: [
      { href: "/integrations/tpi", label: "TPI TOTVS", icon: "Landmark", resource: "integrations", action: "execute" },
      { href: "/integrations/cielo", label: "Cielo", icon: "CreditCard", resource: "integrations", action: "execute" },
      { href: "/integrations/ai", label: "Assistente IA", icon: "Sparkles", resource: "integrations", action: "execute" },
    ],
  },
  {
    section: "Integrações",
    label: "Automações",
    icon: "CalendarClock",
    items: [
      { href: "/integrations/report-schedules", label: "Envio de relatórios", icon: "CalendarClock", resource: "report_schedules", action: "read" },
      { href: "/integrations/sheet-syncs", label: "Planilhas Google", icon: "FileSpreadsheet", resource: "sheet_syncs", action: "read" },
    ],
  },
  {
    section: "Integrações",
    label: "Comunicação",
    icon: "MessageSquareText",
    items: [
      { href: "/integrations/email", label: "E-mail (SMTP)", icon: "Mail", resource: "integrations", action: "execute" },
      { href: "/integrations/message-templates", label: "Templates de mensagem", icon: "MessageSquareText", resource: "message_templates", action: "read" },
    ],
  },

  // ── Administração (/admin) ──────────────────────────────────────────────────
  {
    section: "Administração",
    label: "Acesso",
    icon: "ShieldCheck",
    items: [
      { href: "/admin/users", label: "Usuários", icon: "Users", resource: "users" },
      { href: "/admin/roles", label: "Papéis e permissões", icon: "ShieldCheck", resource: "roles" },
    ],
  },
  {
    section: "Administração",
    label: "Sistema",
    icon: "Settings",
    items: [
      { href: "/admin/activity", label: "Rastreamento de atividades", icon: "Activity", resource: null },
      { href: "/admin/settings", label: "Configurações", icon: "Settings", resource: "settings", action: "manage" },
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

/** First nav route this permission set can actually open — used to land a user somewhere
 *  meaningful (e.g. after a forced password reset) instead of assuming `/dashboard`. */
export function getFirstAllowedRoute(permissions: string[]): string {
  const allowed = flattenNavItems().find((item) => !item.resource || hasPermission(permissions, item.resource, item.action || "read"));
  return allowed?.href ?? "/dashboard";
}

/** Sidebar groups the user may see ("Conta" lives in the avatar menu). Runs on the server layout. */
export function visibleNavGroups(permissions: string[]): NavGroup[] {
  return navGroups
    .filter((g) => g.label !== "Conta")
    .map((group) => ({
      ...group,
      items: group.items.filter((item) => !item.resource || hasPermission(permissions, item.resource, item.action ?? "read")),
    }))
    .filter((group) => group.items.length > 0);
}
