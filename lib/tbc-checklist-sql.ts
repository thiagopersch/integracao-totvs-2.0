import { INTEGER_TYPES, ZERO_IS_MEANINGFUL } from "@/lib/tbc-checklist-field-rules"
import { buildPickerTabs, checklistSelection, fieldKey } from "@/lib/tbc-checklist-selection"
import { dialectOps, SQL_DIALECT_LABELS, SQL_DIALECTS, type SqlDialect } from "@/lib/tbc-checklist-sql-dialect"
import {
  datasetTableSource,
  RM_PHYSICAL_CATALOG,
  resolvePhysicalColumn,
  type PhysicalCatalog,
  type PhysicalColumn,
} from "@/lib/tbc-checklist-sql-sources"
import type { TbcChecklistLink } from "@/schemas/tbc-checklist.schema"
import type { SchemaField, SchemaRelation, SchemaTable } from "@/utils/soap-schema"

/**
 * Builds, from a saved checklist (its Data Servers and picked fields), the four RM Consultas SQL the
 * Rubeus checklist page (`checklist.php`) reads — the RB.PS.VALIDA.1–4 contract:
 * 1. one row per processo seletivo (PROCESSO_SELETIVO, CODCOLIGADA, IDPS + one column per field:
 *    'T' configurado, 'F' não configurado, NULL não preenchido) — no parameter;
 * 2. the same per área de interesse (IDPS, CODCOLIGADA, IDAREAINTERESSE, AREA_INTERESSE), by
 *    :CODCOLIGADA/:IDPS;
 * 3/4. the details of 1/2 — same column names (the page pairs them by name), NULL when ok and a red
 *    HTML warning otherwise — by :CODCOLIGADA/:IDPS (and :IDAREAINTERESSE).
 * Fields of a child table (1:N) become one status per processo/área (`MAX`: 'T' when any row is).
 * A Data Server whose main table lacks CODCOLIGADA/IDPS reaches them through its links to other
 * Data Servers of the checklist (INNER JOINs from main table to main table, by the link's fields).
 */

export type ChecklistSqlDataserver = {
  code: string
  fields: { table: string; name: string }[]
  tables: SchemaTable[]
  relations: SchemaRelation[]
  /** Its links to other Data Servers of the checklist (by code) — main-table column pairs. */
  links?: TbcChecklistLink[]
}

export type ChecklistSqlFile = { code: string; title: string; fileName: string; sql: string }

export type ChecklistSqlResult = { files: Record<SqlDialect, ChecklistSqlFile[]>; warnings: string[] }

type Level = "processo" | "area"

const LEVEL_KEYS: Record<Level, string[]> = {
  processo: ["CODCOLIGADA", "IDPS"],
  area: ["CODCOLIGADA", "IDPS", "IDAREAINTERESSE"],
}

/** One row per processo / área comes from this table — the base CTE every other one joins to. */
const DRIVER_TABLE: Record<Level, string> = { processo: "SPSPROCESSOSELETIVO", area: "SPSAREAOFERTADA" }
const DRIVER_CTE: Record<Level, string> = { processo: "PROCESSOSELETIVO", area: "AREAOFERTADA" }

/** Columns the page reads as keys (never as checklist items), plus the driver CTE's own NOME. */
const RESERVED_ALIASES = ["CODCOLIGADA", "IDPS", "IDAREAINTERESSE", "AREA_INTERESSE", "PROCESSO_SELETIVO", "NOME"]

type QuerySpec = { code: string; title: string; level: Level; detail: boolean; params: string[] }

const QUERIES: QuerySpec[] = [
  { code: "RB.PS.VALIDA.1", title: "PROCESSO SELETIVO", level: "processo", detail: false, params: [] },
  { code: "RB.PS.VALIDA.2", title: "ÁREA DE INTERESSE", level: "area", detail: false, params: ["CODCOLIGADA", "IDPS"] },
  {
    code: "RB.PS.VALIDA.3",
    title: "CONSULTA PARA DETALHES DO PROCESSO SELETIVO",
    level: "processo",
    detail: true,
    params: ["CODCOLIGADA", "IDPS"],
  },
  {
    code: "RB.PS.VALIDA.4",
    title: "CONSULTA PARA DETALHES DA ÁREA DE INTERESSE",
    level: "area",
    detail: true,
    params: ["CODCOLIGADA", "IDPS", "IDAREAINTERESSE"],
  },
]

type FieldKind = "number" | "flag" | "text" | "date" | "binary"

const NUMBER_TYPES = new Set([...INTEGER_TYPES, "unsignedlong", "decimal", "double", "float", "boolean"])
const DATE_TYPES = new Set(["datetime", "date", "time"])

/** RM flags are 1-char "T"/"F" strings (`maxLength` 1, or a T/F default). */
function fieldKind(field: SchemaField): FieldKind {
  const type = field.type.toLowerCase()
  if (NUMBER_TYPES.has(type)) return "number"
  if (DATE_TYPES.has(type)) return "date"
  if (type === "base64binary") return "binary"
  if (field.maxLength === "1" || /^[TF]$/i.test(field.defaultValue)) return "flag"
  return "text"
}

type CheckColumn = {
  alias: string
  caption: string
  /** "Aba > Seção" of the TOTVS screen — where the analyst fixes it. */
  where: string
  table: string
  column: string
  kind: FieldKind
  /** An enumeration whose 0 is a real option: any non-null value counts as configured. */
  zeroCounts: boolean
  /** The source has several rows per processo/área — status is aggregated. */
  many: boolean
  /** Same-table column that makes this field "não se aplica" when null or 1 (TIPOARQUIVO for
   *  DIRETORIOARQUIVO: files stored in the database need no folder — the checklist screen's rule). */
  notApplicableWhen?: string
}

/** `INNER JOIN table [alias] ON on[0] AND on[1]…` — `alias` is the table's own name unless that
 *  table already appears in the same FROM. */
type Join = { table: string; alias: string; on: string[] }

type Source = {
  /** Identity of the FROM (table, joins, keys) — fields sharing it share the CTE. */
  key: string
  cte: string
  table: string
  /** INNER JOINs up the XSD relations, when `table` lacks the processo/área keys itself. */
  joins: Join[]
  /** Table the link keys are read from (`table` itself, or the last joined ancestor). */
  keyTable: string
  linkKeys: string[]
  driver: boolean
  columns: CheckColumn[]
}

type LevelPlan = {
  sources: Source[]
  columns: { column: CheckColumn; source: Source }[]
  dataservers: string[]
  notes: string[]
}

const sameName = (a: string, b: string) => a.toLowerCase() === b.toLowerCase()
const upper = (s: string) => s.toUpperCase()
const hasField = (table: SchemaTable, name: string) => table.fields.some((f) => sameName(f.name, name))
const findTable = (tables: SchemaTable[], name: string) => tables.find((t) => sameName(t.name, name))

// ---------------------------------------------------------------------------------------------
// Names
// ---------------------------------------------------------------------------------------------

const MAX_IDENTIFIER = 120

/** Words both databases reject (or read differently) as a bare column alias. */
const SQL_RESERVED = new Set(
  (
    "ACCESS ADD ALL ALTER AND ANY AS ASC BACKUP BEGIN BETWEEN BY CASE CHAR CHECK CLOSE CLUSTERED COLUMN COMMENT " +
    "COMMIT CREATE CROSS CURRENT CURSOR DATABASE DATE DECIMAL DEFAULT DELETE DESC DISTINCT DROP ELSE END EXEC " +
    "EXECUTE EXISTS FETCH FILE FLOAT FOR FROM FULL FUNCTION GRANT GROUP HAVING IDENTIFIED IDENTITY IN INDEX INNER " +
    "INSERT INTEGER INTERSECT INTO IS JOIN KEY LEFT LEVEL LIKE LOCK LONG MINUS MODE NOT NULL NUMBER OF ON OPEN " +
    "OPTION OR ORDER OUTER PERCENT PLAN PRIMARY PROCEDURE PUBLIC RAW READ RIGHT ROW ROWID ROWNUM ROWS RULE " +
    "SCHEMA SELECT SESSION SET SIZE START SYNONYM TABLE THEN TO TOP TRAN TRANSACTION TRIGGER UID UNION UNIQUE " +
    "UPDATE USER VALUES VARCHAR VIEW WHEN WHERE WITH"
  ).split(" ")
)

/** "Tipo de armazenamento" → TIPO_DE_ARMAZENAMENTO — the page turns it back into the label. */
export function sqlIdentifier(text: string): string {
  const id = text
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
  return (/^\d/.test(id) ? `C_${id}` : id).slice(0, MAX_IDENTIFIER).replace(/_+$/, "")
}

/** The caption, then caption + section, then caption + field name, then a numeric suffix. */
function uniqueAlias(used: Set<string>, caption: string, name: string, section: string): string {
  const base = sqlIdentifier(caption) || sqlIdentifier(name)
  const candidates = [base, sqlIdentifier(`${caption} ${section}`), sqlIdentifier(`${caption} ${name}`)]
  let alias = candidates.find((c) => c && !used.has(c) && !SQL_RESERVED.has(c))
  for (let n = 2; !alias; n++) {
    const candidate = `${base.slice(0, MAX_IDENTIFIER - 4)}_${n}`
    if (!used.has(candidate)) alias = candidate
  }
  used.add(alias)
  return alias
}

/** SPSPARAMETROPS → PARAMETROPS, like the hand-written models; other tables get a CK_ prefix. */
function uniqueCteName(used: Set<string>, table: string): string {
  const name = upper(table)
  const base = name.startsWith("SPS") && name.length > 3 ? name.slice(3) : `CK_${name}`
  let cte = base
  for (let n = 2; used.has(cte); n++) cte = `${base}_${n}`
  used.add(cte)
  return cte
}

// ---------------------------------------------------------------------------------------------
// Plan — which physical table, join and alias each picked field becomes (dialect-independent)
// ---------------------------------------------------------------------------------------------

type Link = { keyTable: string; linkKeys: string[]; joins: Join[]; many: boolean }

/** One step up a Data Server link: from the current table to `table` (the parent Data Server's
 *  main table), `parent` columns of `table` = `child` columns of the current one. */
type Hop = { table: string; on: { parent: string; child: string }[] }

/**
 * How a Data Server's main table reaches the processo/área keys. Own keys: `path` is empty.
 * Through links: `path` follows its primary parent (and that one's, up to a table with the keys),
 * and `extras` are its other direct parents, each tied to the same keys it has in common.
 */
type Reach = {
  level: Level
  keys: string[]
  path: Hop[]
  extras: { path: Hop[]; keys: string[] }[]
  /** Parent Data Servers along `path`, nearest first. */
  via: string[]
}

/** How rows of `datasetTable` reach the processo/área keys (`reach.keys`): directly when the table
 *  has them, else up the XSD relations to the first ancestor that does — and, for a Data Server
 *  linked to others, from its main table up the links. */
function linkFor(ds: ChecklistSqlDataserver, datasetTable: SchemaTable, resolved: Extract<PhysicalColumn, { kind: "column" }>, reach: Reach): Link | null {
  const target = reach.keys
  const linked = reach.path.length > 0
  const pk = datasetTable.fields.filter((f) => f.isPrimaryKey).map((f) => upper(f.name))
  const oneToOne = pk.length > 0 && pk.every((k) => target.includes(k))

  if (resolved.extension && !linked) {
    const on = resolved.extension.on.map(upper)
    const linkKeys = target.filter((k) => on.includes(k))
    return linkKeys.length ? { keyTable: resolved.table, linkKeys, joins: [], many: !oneToOne } : null
  }

  const joins: Join[] = []
  const used = new Set([resolved.table])
  const join = (table: string, on: (alias: string) => string[]) => {
    let alias = table
    for (let n = 2; used.has(alias); n++) alias = `${table}_${n}`
    used.add(alias)
    joins.push({ table, alias, on: on(alias) })
    return alias
  }
  const follow = (path: Hop[], from: string) =>
    path.reduce((ref, hop) => join(hop.table, (alias) => hop.on.map((f) => `${alias}.${f.parent} = ${ref}.${f.child}`)), from)

  let current = datasetTable
  let currentRef = resolved.table
  if (resolved.extension) {
    // 1:1 with its base table — joined to walk on from there.
    const { base } = datasetTableSource(datasetTable.name)
    const on = resolved.extension.on.map(upper)
    const from = currentRef
    currentRef = join(base, (alias) => on.map((c) => `${alias}.${c} = ${from}.${c}`))
  }
  const visited = new Set([upper(current.name)])
  while (!target.every((k) => hasField(current, k))) {
    const relation = ds.relations.find((r) => sameName(r.child, current.name))
    const parent = relation && findTable(ds.tables, relation.parent)
    if (!relation || !parent || visited.has(upper(parent.name))) break
    visited.add(upper(parent.name))
    const from = currentRef
    currentRef = join(datasetTableSource(parent.name).base, (alias) => relation.fields.map((f) => `${alias}.${f.parent} = ${from}.${f.child}`))
    current = parent
  }

  if (linked && !target.every((k) => hasField(current, k))) {
    if (!sameName(current.name, ds.tables[0].name)) return null
    const from = currentRef
    const keyRef = follow(reach.path, from)
    for (const extra of reach.extras) {
      const extraRef = follow(extra.path, from)
      joins[joins.length - 1].on.push(...extra.keys.map((k) => `${extraRef}.${k} = ${keyRef}.${k}`))
    }
    return { keyTable: keyRef, linkKeys: target, joins, many: true }
  }
  const linkKeys = target.filter((k) => hasField(current, k))
  return linkKeys.length ? { keyTable: currentRef, linkKeys, joins, many: joins.length > 0 || !oneToOne } : null
}

const LEVEL_RANK: Record<Level, number> = { area: 1, processo: 0 }

/** Best route to the keys first: área over processo, then more keys, then fewer hops. */
function compareReach(a: Reach, b: Reach): number {
  return LEVEL_RANK[b.level] - LEVEL_RANK[a.level] || b.keys.length - a.keys.length || a.path.length - b.path.length
}

function planChecklist(dataservers: ChecklistSqlDataserver[], catalog: PhysicalCatalog) {
  const warnings: string[] = []
  const warn = (message: string) => {
    if (!warnings.includes(message)) warnings.push(message)
  }
  const levels: Record<Level, LevelPlan> = {
    processo: { sources: [], columns: [], dataservers: [], notes: [] },
    area: { sources: [], columns: [], dataservers: [], notes: [] },
  }
  const aliases: Record<Level, Set<string>> = { processo: new Set(RESERVED_ALIASES), area: new Set(RESERVED_ALIASES) }
  const cteNames: Record<Level, Set<string>> = { processo: new Set(Object.values(DRIVER_CTE)), area: new Set(Object.values(DRIVER_CTE)) }
  const unverified = new Set<string>()
  const byCode = new Map(dataservers.map((ds) => [ds.code, ds]))
  const reaches = new Map<string, Reach | null>()

  /** A link as a hop from `ds`'s main table to its parent's — when every pair names real columns
   *  of both base tables (a column TOTVS computes, or one of an extension table, can't be joined). */
  function hopFor(ds: ChecklistSqlDataserver, link: TbcChecklistLink): Hop | null {
    const parentMain = byCode.get(link.parentCode)?.tables[0]
    if (!parentMain) {
      warn(`${ds.code}: o Data Server vinculado ${link.parentCode} não está no checklist — vínculo fora da SQL.`)
      return null
    }
    const isBaseColumn = (table: SchemaTable, column: string) => {
      if (!hasField(table, column)) return false
      const resolved = resolvePhysicalColumn(table.name, column, catalog)
      // An extension's join columns are in the base table too.
      return resolved.kind === "column" && (!resolved.extension || resolved.extension.on.some((c) => sameName(c, column)))
    }
    const invalid = link.fields.filter((f) => !isBaseColumn(ds.tables[0], f.child) || !isBaseColumn(parentMain, f.parent))
    if (invalid.length) {
      warn(
        `${ds.code}: o vínculo com ${link.parentCode} usa ${invalid.map((f) => `${f.parent} = ${f.child}`).join(", ")}, que não são colunas das tabelas principais — vínculo fora da SQL.`
      )
      return null
    }
    return { table: datasetTableSource(parentMain.name).base, on: link.fields.map((f) => ({ parent: upper(f.parent), child: upper(f.child) })) }
  }

  /** Own keys when the main table has CODCOLIGADA + IDPS (links aren't needed then) or no link
   *  leads anywhere; else the best route up the links. Memoized; links never form a cycle. */
  function reachOf(code: string, visiting: Set<string>): Reach | null {
    if (reaches.has(code)) return reaches.get(code) ?? null
    const ds = byCode.get(code)
    const main = ds?.tables[0]
    if (!ds || !main) return null
    const columns = new Set(main.fields.map((f) => upper(f.name)))
    const ownLevel: Level = columns.has("IDAREAINTERESSE") && columns.has("IDPS") ? "area" : "processo"
    const ownKeys = LEVEL_KEYS[ownLevel].filter((k) => columns.has(k))
    let reach: Reach | null = ownKeys.length ? { level: ownLevel, keys: ownKeys, path: [], extras: [], via: [] } : null

    const links = ds.links ?? []
    if (links.length && !(columns.has("CODCOLIGADA") && columns.has("IDPS")) && !visiting.has(code)) {
      const next = new Set([...visiting, code])
      const routes = links
        .flatMap((link, order) => {
          const parent = reachOf(link.parentCode, next)
          const hop = parent && hopFor(ds, link)
          return parent && hop ? [{ link, order, parent, path: [hop, ...parent.path] }] : []
        })
        .sort((a, b) => compareReach({ ...a.parent, path: a.path }, { ...b.parent, path: b.path }) || a.order - b.order)
      const [primary, ...others] = routes
      if (primary) {
        const extras = others.flatMap((other) => {
          const keys = primary.parent.keys.filter((k) => other.parent.keys.includes(k))
          if (keys.length) return [{ path: other.path, keys }]
          warn(`${code}: o vínculo com ${other.link.parentCode} não tem chaves em comum com o de ${primary.link.parentCode} — fora da SQL.`)
          return []
        })
        reach = { level: primary.parent.level, keys: primary.parent.keys, path: primary.path, extras, via: [primary.link.parentCode, ...primary.parent.via] }
      } else if (reach) {
        warn(`${code}: nenhum vínculo leva às chaves do processo — ligado só por ${reach.keys.join(", ")}.`)
      }
    }
    reaches.set(code, reach)
    return reach
  }

  for (const ds of dataservers) {
    const main = ds.tables[0]
    if (!main) {
      warn(`${ds.code}: o GetSchema não retornou tabelas — Data Server fora da SQL.`)
      continue
    }
    const reach = reachOf(ds.code, new Set())
    if (!reach) {
      warn(
        `${ds.code}: a tabela ${main.name} não tem CODCOLIGADA nem IDPS${ds.links?.length ? ", nem pelos vínculos," : ""} — não há como ligá-la ao processo seletivo.`
      )
      continue
    }
    const { level, keys: target } = reach
    const plan = levels[level]
    plan.dataservers.push(ds.code)
    if (reach.path.length) {
      plan.notes.push(`${ds.code} se liga pelos vínculos com ${reach.via.join(" > ")}.`)
      const followedOnce = reach.via.filter((c) => (byCode.get(c)?.links?.length ?? 0) > 1 && !!reaches.get(c)?.path.length)
      if (followedOnce.length) plan.notes.push(`${ds.code}: de ${followedOnce.join(", ")}, a SQL segue só o vínculo principal.`)
    } else if (target.length < LEVEL_KEYS[level].length) {
      plan.notes.push(`${ds.code} só se liga por ${target.join(", ")}.`)
    }

    for (const f of ds.fields) {
      const table = findTable(ds.tables, f.table)
      if (!table || !hasField(table, f.name)) warn(`${ds.code}: o campo ${f.table}.${f.name} não existe mais no Data Server.`)
    }

    const selection = checklistSelection(ds.fields, ds.tables)
    const seen = new Set<string>()
    for (const tab of buildPickerTabs(ds.code, ds.tables)) {
      for (const section of tab.sections) {
        // A whole-table section is titled after its table — the tab already says it better.
        const sectionLabel = tab.name !== "Campos" && sameName(section.title, section.table) ? tab.name : section.title
        const where = tab.name === "Campos" || sameName(tab.name, sectionLabel) ? sectionLabel : `${tab.name} > ${sectionLabel}`
        for (const field of section.fields) {
          const key = fieldKey(section.table, field.name)
          if (!selection.has(key) || seen.has(key)) continue
          seen.add(key)
          const datasetTable = findTable(ds.tables, section.table)
          if (!datasetTable) continue
          const caption = field.caption && field.caption !== "-" ? field.caption : field.name

          const resolved = resolvePhysicalColumn(datasetTable.name, field.name, catalog)
          if (resolved.kind === "computed") {
            const note = `${datasetTable.name}.${field.name} (${caption}) é calculado pelo TOTVS — não existe em ${datasetTableSource(datasetTable.name).base} e ficou fora da SQL.`
            plan.notes.push(note)
            warn(note)
            continue
          }
          if (!resolved.verified) unverified.add(resolved.table)

          const link = linkFor(ds, datasetTable, resolved, reach)
          if (!link) {
            warn(`${datasetTable.name}.${field.name}: ${resolved.table} não tem as chaves ${target.join(", ")} — fora da SQL.`)
            continue
          }

          const driver = resolved.table === DRIVER_TABLE[level] && !link.joins.length && link.linkKeys.length === LEVEL_KEYS[level].length
          const sourceKey = `${resolved.table}|${JSON.stringify(link.joins)}|${link.linkKeys.join(",")}`
          let source = plan.sources.find((s) => s.key === sourceKey)
          if (!source) {
            source = {
              key: sourceKey,
              cte: driver ? DRIVER_CTE[level] : uniqueCteName(cteNames[level], resolved.table),
              table: resolved.table,
              joins: link.joins,
              keyTable: link.keyTable,
              linkKeys: link.linkKeys,
              driver,
              columns: [],
            }
            plan.sources.push(source)
          }
          if (source.columns.some((c) => c.column === upper(field.name))) continue

          let notApplicableWhen: string | undefined
          if (upper(field.name) === "DIRETORIOARQUIVO" && hasField(datasetTable, "TIPOARQUIVO")) {
            const storage = resolvePhysicalColumn(datasetTable.name, "TIPOARQUIVO", catalog)
            if (storage.kind === "column" && storage.table === resolved.table) notApplicableWhen = "TIPOARQUIVO"
          }

          const column: CheckColumn = {
            alias: uniqueAlias(aliases[level], caption, field.name, sectionLabel),
            caption,
            where,
            table: resolved.table,
            column: upper(field.name),
            kind: fieldKind(field),
            zeroCounts: ZERO_IS_MEANINGFUL.has(upper(field.name)),
            many: !driver && link.many,
            notApplicableWhen,
          }
          source.columns.push(column)
          plan.columns.push({ column, source })
        }
      }
    }
  }

  if (unverified.size) {
    warn(
      `Tabelas fora do catálogo de colunas do RM (${[...unverified].join(", ")}): os campos foram assumidos nelas sem conferência — se a consulta acusar coluna inválida, o campo mora em outra tabela.`
    )
  }
  return { levels, warnings }
}

// ---------------------------------------------------------------------------------------------
// Render
// ---------------------------------------------------------------------------------------------

const INDENT = "    "

function sqlString(value: string): string {
  return `'${value.replace(/'/g, "''")}'`
}

function sqlComment(text: string): string {
  return text.replace(/\*\//g, "* /")
}

/** Accents go out as numeric entities, so the literal is plain ASCII whatever the database charset. */
function htmlText(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;")
    .replace(/[^ -~]/gu, (ch) => `&#${ch.codePointAt(0)};`)
}

/** Same red box as the hand-written RB.PS.VALIDA.3/4. */
function warningHtml(title: string, body: string): string {
  return (
    '<div style="font-family: sans-serif; background-color: #fef2f2; border: 1px solid #fecaca; border-left: 4px solid #ef4444; border-radius: 8px; padding: 12px 16px; margin: 8px 0;">' +
    `<div style="font-weight: 700; color: #991b1b; font-size: 13px; margin-bottom: 4px;">${title}</div>` +
    `<div style="font-size: 12px; color: #7f1d1d; font-weight: 500;">${body}</div></div>`
  )
}

function detailMessages(column: CheckColumn): { negative: string; blank: string } {
  const caption = htmlText(column.caption)
  const field = `<b>${caption}</b>`
  const fix = `Verifique em <b>${htmlText(column.where)}</b> (${htmlText(`${column.table}.${column.column}`)}).`
  if (column.many) {
    return {
      negative: warningHtml(`${caption}: ${htmlText("nenhum registro configurado")}`, `${htmlText("Nenhum registro está com o campo")} ${field} ${htmlText("marcado ou maior que zero.")} ${fix}`),
      blank: warningHtml(`${caption}: ${htmlText("nenhum registro")}`, `${htmlText("Nenhum registro com o campo")} ${field} ${htmlText("preenchido.")} ${fix}`),
    }
  }
  return {
    negative: warningHtml(`${caption}: ${htmlText("não configurado")}`, `${htmlText("O campo")} ${field} ${htmlText("está desmarcado ou zerado.")} ${fix}`),
    blank: warningHtml(`${caption}: ${htmlText("não preenchido")}`, `${htmlText("O campo")} ${field} ${htmlText("não está preenchido.")} ${fix}`),
  }
}

/**
 * The field's internal code — 'T' configured, 'F' not configured, NULL blank, 'A' não se aplica.
 * 'A' < 'F' < 'T', so MAX over child rows gives 'T' when any row is configured, then 'F', then 'A'.
 */
function codeCase(dialect: SqlDialect, column: CheckColumn, depth: number): string {
  const ops = dialectOps(dialect)
  const c = `${column.table}.${column.column}`
  const whens: string[] = []
  if (column.notApplicableWhen) {
    const when = `${column.table}.${column.notApplicableWhen}`
    whens.push(`WHEN ${when} IS NULL OR ${when} = 1 THEN 'A'`)
  }
  switch (column.kind) {
    case "number":
      whens.push(`WHEN ${c} IS NULL THEN NULL`)
      if (!column.zeroCounts) whens.push(`WHEN ${c} <= 0 THEN 'F'`)
      break
    case "date":
      whens.push(`WHEN ${c} IS NULL THEN NULL`)
      break
    case "binary":
      whens.push(`WHEN ${ops.blankBinary(c)} THEN NULL`)
      break
    case "flag":
      whens.push(`WHEN ${ops.blankText(c)} THEN NULL`, `WHEN UPPER(${c}) IN ('F', 'N', '0') THEN 'F'`)
      break
    case "text":
      whens.push(`WHEN ${ops.blankText(c)} THEN NULL`)
      break
  }
  const pad = INDENT.repeat(depth)
  return ["CASE", ...whens.map((w) => `${pad}${INDENT}${w}`), `${pad}${INDENT}ELSE 'T'`, `${pad}END`].join("\n")
}

/** Select-list lines, with an "Aba > Seção" comment line (like the models' section markers)
 *  whenever the section changes. */
function selectList(items: { where?: string; sql: string }[], depth: number): string {
  const pad = INDENT.repeat(depth)
  const lines: string[] = []
  let lastWhere: string | undefined
  items.forEach((item, index) => {
    if (item.where && item.where !== lastWhere) lines.push(`${pad}/**** ${sqlComment(item.where)} ****/`)
    lastWhere = item.where ?? lastWhere
    lines.push(`${pad}${item.sql}${index < items.length - 1 ? "," : ""}`)
  })
  return lines.join("\n")
}

function paramFilters(table: string, keys: string[], params: string[]): string[] {
  return keys.filter((k) => params.includes(k)).map((k) => `${table}.${k} = :${k}`)
}

function whereClause(conditions: string[], depth: number): string {
  if (!conditions.length) return ""
  const pad = INDENT.repeat(depth)
  return `\n${pad}WHERE ${conditions.join(`\n${pad}${INDENT}AND `)}`
}

function driverCte(spec: QuerySpec, plan: LevelPlan, dialect: SqlDialect): string {
  const table = DRIVER_TABLE[spec.level]
  const driver = plan.sources.find((s) => s.driver)
  const columns = (driver?.columns ?? []).map((c) => ({ where: c.where, sql: `${codeCase(dialect, c, 2)} AS ${c.alias}` }))
  const keys =
    spec.level === "processo"
      ? [`${table}.CODCOLIGADA`, `${table}.IDPS`, `${table}.NOME`]
      : [`${table}.CODCOLIGADA`, `${table}.IDPS`, `${table}.IDAREAINTERESSE`, "SPSAREAINTERESSE.NOME AS AREA_INTERESSE"]
  const from =
    spec.level === "processo"
      ? `FROM ${table}`
      : `FROM ${table}\n${INDENT}${INDENT}INNER JOIN SPSAREAINTERESSE ON SPSAREAINTERESSE.IDAREAINTERESSE = ${table}.IDAREAINTERESSE`
  const conditions = [
    ...(spec.level === "processo" ? [`${table}.STATUS = 'T'`] : []),
    ...paramFilters(table, LEVEL_KEYS[spec.level], spec.params),
  ]
  return [
    `${DRIVER_CTE[spec.level]} AS (`,
    `${INDENT}SELECT`,
    selectList([...keys.map((sql) => ({ sql })), ...columns], 2),
    `${INDENT}${from}${whereClause(conditions, 1)}`,
    ")",
  ].join("\n")
}

function aggregateCte(spec: QuerySpec, source: Source, dialect: SqlDialect): string {
  const keys = source.linkKeys.map((k) => `${source.keyTable}.${k}`)
  const columns = source.columns.map((c) => ({
    where: c.where,
    sql: `MAX(\n${INDENT.repeat(3)}${codeCase(dialect, c, 3)}\n${INDENT.repeat(2)}) AS ${c.alias}`,
  }))
  const joins = source.joins.map(
    (j) => `\n${INDENT}${INDENT}INNER JOIN ${j.table}${j.alias === j.table ? "" : ` ${j.alias}`} ON ${j.on.join(`\n${INDENT}${INDENT}AND `)}`
  )
  return [
    `${source.cte} AS (`,
    `${INDENT}SELECT`,
    selectList([...keys.map((sql) => ({ sql })), ...columns], 2),
    `${INDENT}FROM ${source.table}${joins.join("")}${whereClause(paramFilters(source.keyTable, source.linkKeys, spec.params), 1)}`,
    `${INDENT}GROUP BY ${keys.join(`,\n${INDENT}${INDENT}`)}`,
    ")",
  ].join("\n")
}

function finalColumn(spec: QuerySpec, column: CheckColumn, source: Source): string {
  const ref = `${source.cte}.${column.alias}`
  if (spec.detail) {
    const { negative, blank } = detailMessages(column)
    const canBeNegative = column.kind === "flag" || (column.kind === "number" && !column.zeroCounts)
    return [
      "CASE",
      ...(canBeNegative ? [`${INDENT}${INDENT}WHEN ${ref} = 'F' THEN ${sqlString(negative)}`] : []),
      `${INDENT}${INDENT}WHEN ${ref} IS NULL THEN ${sqlString(blank)}`,
      `${INDENT}${INDENT}ELSE NULL`,
      `${INDENT}END AS ${column.alias}`,
    ].join("\n")
  }
  return column.notApplicableWhen ? `CASE WHEN ${ref} = 'A' THEN NULL ELSE ${ref} END AS ${column.alias}` : ref
}

function header(spec: QuerySpec, plan: LevelPlan, dialect: SqlDialect, checklistName: string): string {
  const lines = [
    `${spec.code} - ${spec.title} (${SQL_DIALECT_LABELS[dialect]})`,
    `Gerada pelo checklist "${checklistName}".`,
    `Data Servers: ${plan.dataservers.length ? plan.dataservers.join(", ") : "nenhum deste nível"}`,
    spec.detail
      ? "Cada coluna: NULL quando configurado, HTML de aviso quando não configurado ou não preenchido."
      : "Cada coluna: 'T' configurado, 'F' não configurado, NULL não preenchido.",
  ]
  if (!plan.columns.length) lines.push("Nenhum campo do checklist pertence a este nível: a consulta só traz as chaves.")
  const links = plan.sources.map((s) =>
    s.driver
      ? `${s.cte}: ${s.table} (uma linha por ${spec.level === "processo" ? "processo seletivo" : "área ofertada"})`
      : `${s.cte}: ${[s.table, ...s.joins.map((j) => j.table)].join(" > ")} por ${s.linkKeys.join(", ")}`
  )
  if (links.length) lines.push("Ligações:", ...links.map((l) => `  ${l}`))
  if (plan.notes.length) lines.push("Observações:", ...plan.notes.map((n) => `  - ${n}`))
  return ["/*", ...lines.map((l) => ` * ${sqlComment(l)}`), " */"].join("\n")
}

function renderQuery(spec: QuerySpec, plan: LevelPlan, dialect: SqlDialect, checklistName: string): string {
  const driverName = DRIVER_CTE[spec.level]
  const ctes = [driverCte(spec, plan, dialect), ...plan.sources.filter((s) => !s.driver).map((s) => aggregateCte(spec, s, dialect))]

  const keys =
    spec.level === "processo"
      ? [`${driverName}.NOME AS PROCESSO_SELETIVO`, `${driverName}.CODCOLIGADA`, `${driverName}.IDPS`]
      : [`${driverName}.IDPS`, `${driverName}.CODCOLIGADA`, `${driverName}.IDAREAINTERESSE`, `${driverName}.AREA_INTERESSE`]
  const columns = plan.columns.map(({ column, source }) => ({ where: column.where, sql: finalColumn(spec, column, source) }))
  const joins = plan.sources
    .filter((s) => !s.driver)
    .map(
      (s) =>
        `${INDENT}LEFT JOIN ${s.cte} ON ${s.linkKeys.map((k) => `${s.cte}.${k} = ${driverName}.${k}`).join(`\n${INDENT}AND `)}`
    )
  const orderBy = spec.level === "processo" ? `ORDER BY ${driverName}.IDPS DESC` : `ORDER BY ${driverName}.IDAREAINTERESSE`

  return [
    header(spec, plan, dialect, checklistName),
    `WITH ${ctes.join(",\n")}`,
    "SELECT",
    selectList([...keys.map((sql) => ({ sql })), ...columns], 1),
    `FROM ${driverName}`,
    ...joins,
    orderBy,
    "",
  ].join("\n")
}

export function buildChecklistSql(input: {
  checklistName: string
  dataservers: ChecklistSqlDataserver[]
  catalog?: PhysicalCatalog
}): ChecklistSqlResult {
  const { levels, warnings } = planChecklist(input.dataservers, input.catalog ?? RM_PHYSICAL_CATALOG)
  const files = Object.fromEntries(
    SQL_DIALECTS.map((dialect) => [
      dialect,
      QUERIES.map((spec) => ({
        code: spec.code,
        title: spec.title,
        fileName: `${spec.code} - ${spec.title} (${SQL_DIALECT_LABELS[dialect]}).sql`,
        sql: renderQuery(spec, levels[spec.level], dialect, input.checklistName),
      })),
    ])
  ) as Record<SqlDialect, ChecklistSqlFile[]>
  return { files, warnings }
}
