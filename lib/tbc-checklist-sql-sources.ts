import catalogJson from "@/data/rm-physical-columns.json"

/**
 * Where the columns of a TOTVS RM DataSet table physically live. GetSchema names DataSet tables,
 * not database tables, and one DataSet table can mix several of them — the live
 * EduPSProcessoSeletivoData "SPSProcessoSeletivo" carries SPSPROCESSOSELETIVO's columns plus
 * SPSPARAMETROPS' (LOGINCPF, TIPOARQUIVO…) plus columns TOTVS computes (NOMEINSTITUICAO) — and the
 * XSD never says which is which. The generated SQL needs the real table, so it is resolved against
 * a catalog of the RM dictionary (`data/rm-physical-columns.json`).
 */

/** Physical table → its columns (uppercase). `complete` = exported from the RM dictionary, so a
 *  column missing from a listed table really doesn't exist there. */
export type PhysicalCatalog = {
  complete: boolean
  tables: Record<string, string[]>
}

export const RM_PHYSICAL_CATALOG: PhysicalCatalog = { complete: catalogJson.complete, tables: catalogJson.tables }

/** A table joined 1:1 to a DataSet table's base, by the same-named columns `on`. */
export type PhysicalExtension = { table: string; on: string[] }

export type DatasetTableSource = { base: string; extensions: PhysicalExtension[] }

/**
 * DataSet tables whose columns come from more than their own table. Any other DataSet table maps to
 * the physical table of the same (uppercased) name, with no extensions.
 */
const DATASET_TABLE_SOURCES: Record<string, DatasetTableSource> = {
  SPSProcessoSeletivo: {
    base: "SPSPROCESSOSELETIVO",
    extensions: [{ table: "SPSPARAMETROPS", on: ["CODCOLIGADA", "IDPS"] }],
  },
  SPSAreaOfertada: {
    base: "SPSAREAOFERTADA",
    extensions: [
      { table: "SPSAREAINTERESSE", on: ["IDAREAINTERESSE"] },
      { table: "SPSPROCESSOSELETIVO", on: ["CODCOLIGADA", "IDPS"] },
    ],
  },
}

export function datasetTableSource(datasetTable: string): DatasetTableSource {
  const entry = Object.entries(DATASET_TABLE_SOURCES).find(([name]) => name.toLowerCase() === datasetTable.toLowerCase())
  return entry?.[1] ?? { base: datasetTable.toUpperCase(), extensions: [] }
}

export type PhysicalColumn =
  /** `verified` = the catalog lists the column in `table`; otherwise the DataSet table's own name
   *  is assumed because the catalog doesn't know that table yet. */
  | { kind: "column"; table: string; extension?: PhysicalExtension; verified: boolean }
  /** Not a column of any table the DataSet table is built from — TOTVS computes it. */
  | { kind: "computed" }

function hasColumn(catalog: PhysicalCatalog, table: string, column: string): boolean | undefined {
  const columns = catalog.tables[table.toUpperCase()]
  return columns ? columns.includes(column.toUpperCase()) : undefined
}

/** The base table first, then each extension, as the catalog lists them. */
export function resolvePhysicalColumn(datasetTable: string, column: string, catalog: PhysicalCatalog): PhysicalColumn {
  const source = datasetTableSource(datasetTable)
  if (hasColumn(catalog, source.base, column)) return { kind: "column", table: source.base, verified: true }
  const extension = source.extensions.find((ext) => hasColumn(catalog, ext.table, column))
  if (extension) return { kind: "column", table: extension.table, extension, verified: true }
  if (catalog.complete && hasColumn(catalog, source.base, column) === false) return { kind: "computed" }
  return { kind: "column", table: source.base, verified: false }
}
