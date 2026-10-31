/**
 * The bits of the checklist SQL that differ between the two databases TOTVS RM runs on. Everything
 * else the generator writes (CASE, MAX/GROUP BY, LEFT JOIN, `:PARAM` — the RM Consulta SQL
 * parameter syntax, valid on both) is the same text for Oracle and SQL Server.
 */

export type SqlDialect = "oracle" | "sqlserver"

export const SQL_DIALECTS: SqlDialect[] = ["oracle", "sqlserver"]

export const SQL_DIALECT_LABELS: Record<SqlDialect, string> = {
  oracle: "Oracle",
  sqlserver: "SQL Server",
}

type DialectOps = {
  /** True when a text column (VARCHAR or CLOB/TEXT) is null, empty or only blanks. */
  blankText: (column: string) => string
  /** True when a binary column (BLOB/IMAGE) is null or empty. */
  blankBinary: (column: string) => string
}

const OPS: Record<SqlDialect, DialectOps> = {
  // '' is NULL in Oracle; LENGTH/TRIM also accept a CLOB (a plain `= ''` or `IS NULL` would not
  // catch an empty CLOB).
  oracle: {
    blankText: (c) => `NVL(LENGTH(TRIM(${c})), 0) = 0`,
    blankBinary: (c) => `NVL(DBMS_LOB.GETLENGTH(${c}), 0) = 0`,
  },
  // LTRIM/RTRIM reject TEXT/NTEXT — the CAST makes the same check work on every text type.
  sqlserver: {
    blankText: (c) => `NULLIF(LTRIM(RTRIM(CAST(${c} AS VARCHAR(MAX)))), '') IS NULL`,
    blankBinary: (c) => `ISNULL(DATALENGTH(${c}), 0) = 0`,
  },
}

export function dialectOps(dialect: SqlDialect): DialectOps {
  return OPS[dialect]
}
