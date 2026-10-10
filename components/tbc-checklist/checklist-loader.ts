import {
  fetchChecklistMainRecords,
  fetchChecklistMainView,
  type ChecklistContext,
  type ChecklistParent,
  type ChecklistTableMeta,
  type ChecklistTableResult,
} from "@/actions/integrations/tbc-checklist"
import { assembleMainTable, buildTableResult, type ChecklistMainRecord } from "@/lib/tbc-checklist-records"

/** Primary keys sent per `fetchChecklistMainRecords` call — each call is one progress step. */
const RECORDS_PER_BATCH = 4

export type MainTableLoad =
  | {
      success: true
      tables: ChecklistTableMeta[]
      mainTable: string
      /** Values the main table was filtered by (e.g. CODCOLIGADA + IDPS). */
      matchValues: Record<string, string>
      mainResult: ChecklistTableResult
      parents: ChecklistParent[]
      truncated: boolean
    }
  | { success: false; error: string; permissionDenied: boolean; cancelled?: boolean }

const CANCELLED = { success: false as const, error: "Carregamento cancelado.", permissionDenied: false, cancelled: true }

/**
 * Loads a Data Server's main table step by step, so the caller can show progress: the view
 * (GetSchema + ReadView) first, then the full records in small ReadRecord batches. `onRecords`
 * reports `done`/`total` after the view (0/total) and after every batch; `isCurrent` stops the
 * remaining batches once the caller no longer needs the result (another processo was picked).
 */
export async function loadMainTable(
  input: { tbcId: string; dataserverCode: string; pkValues: Record<string, string>; context: ChecklistContext },
  onRecords: (done: number, total: number) => void,
  isCurrent: () => boolean
): Promise<MainTableLoad> {
  const view = await fetchChecklistMainView(input)
  if (!view.success) return view
  if (!isCurrent()) return CANCELLED
  const mainMeta = view.tables.find((t) => t.name === view.mainTable) ?? view.tables[0]
  const loaded = {
    success: true as const,
    tables: view.tables,
    mainTable: view.mainTable,
    matchValues: view.appliedFilter,
    truncated: view.truncated,
  }

  const total = view.primaryKeys.length
  onRecords(0, total)
  if (!total) {
    // No primary key (or no matching row): the view columns are all there is.
    return { ...loaded, mainResult: buildTableResult(mainMeta, view.viewRows), parents: [] }
  }

  const records: ChecklistMainRecord[] = []
  for (let start = 0; start < total; start += RECORDS_PER_BATCH) {
    if (!isCurrent()) return CANCELLED
    const batch = await fetchChecklistMainRecords({
      tbcId: input.tbcId,
      dataserverCode: input.dataserverCode,
      context: input.context,
      mainTable: view.mainTable,
      primaryKeys: view.primaryKeys.slice(start, start + RECORDS_PER_BATCH),
    })
    if (!batch.success) return batch
    records.push(...batch.records)
    onRecords(records.length, total)
  }

  return { ...loaded, ...assembleMainTable(mainMeta, view.viewRows, records) }
}
