/**
 * Human labels for Prisma model names, reused both for "who is blocking this
 * delete" messages (referencing model) and for the entity column on the
 * centralized deletion-error log (target model).
 *
 * Client-safe: no server-only imports (contrast with lib/entity-relations.ts,
 * which pulls in prisma/pg and cannot be imported from Client Components).
 */
export const ENTITY_LABELS: Record<string, string> = {
  Dataserver: "Dataservers",
  Process: "Processos",
  Client: "Clientes",
  Tbc: "TBCs",
  Filter: "Filtros",
  Backup: "Backups",
  BackupRun: "Execuções de Backup",
  SentenceCategory: "Categorias de Sentença",
  Sentence: "Sentenças",
  TotvsSystem: "Sistemas TOTVS",
  User: "Usuários",
  Role: "Papéis",
  Analyst: "Analistas",
  ClientContract: "Contratos",
  Requester: "Solicitantes",
  Department: "Departamentos",
  DemandType: "Tipos de Demanda",
  Demand: "Demandas",
  Tag: "Tags",
  DemandTag: "Tags de Demanda",
  Comment: "Comentários",
  Attachment: "Anexos",
  Notification: "Notificações",
  SoapLog: "Logs SOAP",
  SoapTemplate: "Templates SOAP",
  SoapFavorite: "Favoritos SOAP",
  AuditLog: "Logs de Auditoria",
  EmailSettings: "Configurações de E-mail",
  MapeadorProjeto: "Projetos Mapeados",
  MapeadorEtapa: "Etapas Mapeadas",
  MapeadorTema: "Temas do Mapeador",
};

export interface BlockingReference {
  model: string;
  label: string;
  field: string;
  count: number;
}

export function formatBlockingReferences(refs: BlockingReference[]): string {
  return refs.map((r) => `${r.label} (${r.count})`).join(", ");
}
