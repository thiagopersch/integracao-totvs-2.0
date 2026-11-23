/** Light, dependency-free reading of a SQL Server / RM query: which physical tables it touches
 *  (with aliases), which identifiers it mentions and which RM parameters it takes. Not a parser —
 *  only enough to cut the TOTVS dictionary down to what the query uses before asking the AI. */

export interface ExtractedTable {
  name: string;
  aliases: string[];
}

export interface SqlExtraction {
  tables: ExtractedTable[];
  /** CTE names (`WITH X AS (…)`) — referenced like tables but not in the dictionary. */
  ctes: string[];
  /** Every bare identifier (upper-case) — used to pick the dictionary columns worth sending. */
  identifiers: Set<string>;
  /** RM parameters: `:CODCOLIGADA`, `:$CODUSUARIO`, `@PARAM` (upper-case, prefix kept). */
  parameters: string[];
}

const KEYWORDS = new Set(
  `SELECT FROM WHERE JOIN INNER LEFT RIGHT FULL OUTER CROSS APPLY ON AND OR NOT IN IS NULL AS WITH NOLOCK GROUP BY ORDER HAVING UNION ALL EXCEPT INTERSECT TOP DISTINCT CASE WHEN THEN ELSE END EXISTS INTO VALUES SET UPDATE DELETE INSERT OUTPUT OPTION PIVOT UNPIVOT FOR XML PATH JSON ASC DESC LIKE BETWEEN OVER PARTITION ROWS FETCH NEXT OFFSET ONLY TABLESAMPLE READUNCOMMITTED`.split(" ")
);

/** Replaces comments with spaces and string literals with `''`, keeping the rest intact. */
export function stripCommentsAndStrings(sql: string): string {
  let out = "";
  let i = 0;
  while (i < sql.length) {
    const ch = sql[i];
    const next = sql[i + 1];
    if (ch === "-" && next === "-") {
      while (i < sql.length && sql[i] !== "\n") i++;
      out += " ";
    } else if (ch === "/" && next === "*") {
      const end = sql.indexOf("*/", i + 2);
      i = end === -1 ? sql.length : end + 2;
      out += " ";
    } else if (ch === "'") {
      i++;
      while (i < sql.length) {
        if (sql[i] === "'" && sql[i + 1] === "'") i += 2;
        else if (sql[i] === "'") break;
        else i++;
      }
      i++;
      out += "''";
    } else {
      out += ch;
      i++;
    }
  }
  return out;
}

/** `[dbo].[SPSCURSO]` / `dbo.SPSCURSO` / `RM..SPSCURSO` → `SPSCURSO`. */
function lastPart(name: string): string {
  const parts = name.replace(/[[\]"`]/g, "").split(".").filter(Boolean);
  return (parts[parts.length - 1] ?? "").toUpperCase();
}

const IDENT = String.raw`(?:\[[^\]]+\]|"[^"]+"|[A-Za-z_#][\w$#]*)`;
const QUALIFIED = String.raw`${IDENT}(?:\s*\.\s*(?:${IDENT})?)*`;

export function extractSql(sql: string): SqlExtraction {
  const clean = stripCommentsAndStrings(sql);
  const ctes = new Set<string>();
  for (const m of clean.matchAll(new RegExp(String.raw`(?:\bWITH|,)\s*(${IDENT})\s*(?:\([^()]*\)\s*)?AS\s*\(`, "gi"))) {
    ctes.add(lastPart(m[1]));
  }

  const tables = new Map<string, Set<string>>();
  const add = (rawName: string, rawAlias?: string) => {
    const name = lastPart(rawName);
    if (!name || name.startsWith("#") || name.startsWith("@") || KEYWORDS.has(name)) return;
    if (!tables.has(name)) tables.set(name, new Set());
    const alias = rawAlias ? lastPart(rawAlias) : "";
    if (alias && !KEYWORDS.has(alias) && alias !== name) tables.get(name)!.add(alias);
  };

  // FROM a [AS] x [WITH (NOLOCK)], b y …  /  JOIN a x  /  APPLY a x  /  UPDATE a  /  INSERT INTO a
  const sourceRe = new RegExp(String.raw`\b(FROM|JOIN|APPLY|UPDATE|INTO)\s+(${QUALIFIED})(?:\s+(?:AS\s+)?(${IDENT}))?`, "gi");
  for (const m of clean.matchAll(sourceRe)) {
    add(m[2], m[3]);
    if (m[1].toUpperCase() !== "FROM") continue;
    // Comma-separated FROM list (old-style joins): read "x alias, y alias" until a keyword / paren.
    let rest = clean.slice((m.index ?? 0) + m[0].length);
    const listRe = new RegExp(String.raw`^\s*(?:WITH\s*\([^)]*\)\s*)?,\s*(${QUALIFIED})(?:\s+(?:AS\s+)?(${IDENT}))?`, "i");
    for (let guard = 0; guard < 50; guard++) {
      const lm = rest.match(listRe);
      if (!lm) break;
      add(lm[1], lm[2]);
      rest = rest.slice(lm[0].length);
    }
  }
  for (const cte of ctes) tables.delete(cte);

  const identifiers = new Set<string>();
  for (const m of clean.matchAll(/\[([^\]]+)\]|\b([A-Za-z_][\w$#]*)\b/g)) identifiers.add((m[1] ?? m[2]).toUpperCase());

  const parameters = new Set<string>();
  for (const m of clean.matchAll(/(?<![:\w])(:\$?[A-Za-z_]\w*)|(?<![@\w])(@[A-Za-z_]\w*)/g)) parameters.add((m[1] ?? m[2]).toUpperCase());

  return {
    tables: [...tables].map(([name, aliases]) => ({ name, aliases: [...aliases] })),
    ctes: [...ctes],
    identifiers,
    parameters: [...parameters],
  };
}
