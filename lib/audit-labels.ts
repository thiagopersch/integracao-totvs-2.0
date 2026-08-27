/** Human labels for AuditLog actions — kept dependency-free (no Prisma/service imports) so it can
 *  be imported from client components (e.g. notification-detail-dialog.tsx) without dragging
 *  server-only code (nodemailer, etc.) into the browser bundle. */
export const ACTION_LABELS: Record<string, string> = {
  CREATE: "criou",
  UPDATE: "atualizou",
  DELETE: "excluiu",
  RESTORE: "restaurou",
  BULK_DELETE: "excluiu em massa",
  BULK_RESTORE: "restaurou em massa",
  ACTIVATE: "ativou",
  DEACTIVATE: "desativou",
  IMPORT_STANDARD_SENTENCES: "importou sentenças padrões para",
};
