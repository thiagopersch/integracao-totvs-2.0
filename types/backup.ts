import type { Backup } from "@/generated/prisma/client"

/** A backup as list queries return it: without the (possibly large) SQL text, which the viewer
 *  dialog fetches on demand (getBackupContent). Rows that do carry it still fit. */
export type BackupListRow = Omit<Backup, "contentSentence"> & { contentSentence?: string | null }
