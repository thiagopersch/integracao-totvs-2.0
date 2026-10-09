import { normalizeText, type FieldSearchHit } from "./field-search";

/** Copy/export formats of the "Busca de campos PS" results — the "Ações" menu over the table.
 *  Pure functions: the page decides what to do with the strings/rows (clipboard, XLSX file). */

/** "Label | nome do componente" — the internal name is left out when it just repeats the label. */
export function componenteLabel(hit: Pick<FieldSearchHit, "componente" | "nomeComponente">): string {
  const { componente, nomeComponente } = hit;
  return nomeComponente && normalizeText(nomeComponente) !== normalizeText(componente) ? `${componente} | ${nomeComponente}` : componente;
}

/** "—" marks a level that doesn't apply (e.g. no portal in "processo" mode). */
const filled = (value?: string): value is string => !!value && value !== "—";

interface Level {
  label: string;
  value: string;
}

/** Portal › Processo › Etapa › Passo, skipping levels that aren't filled. */
function levelsOf(hit: FieldSearchHit): Level[] {
  const levels: Level[] = [];
  if (filled(hit.portal)) levels.push({ label: "Portal", value: hit.portal });
  if (filled(hit.processo)) levels.push({ label: "Processo", value: hit.processo });
  if (filled(hit.etapa)) levels.push({ label: "Etapa", value: hit.etapa });
  if (filled(hit.passo)) levels.push({ label: "Passo", value: hit.passo });
  return levels;
}

/** Per-occurrence lines, only for what's filled. `code` marks values shown as code in Markdown. */
function detailLines(hit: FieldSearchHit): { label: string; value: string; code?: boolean }[] {
  const lines: { label: string; value: string; code?: boolean }[] = [];
  if (filled(hit.feedback)) lines.push({ label: "Feedback", value: hit.feedback });
  if (filled(hit.pagina)) lines.push({ label: "Página", value: hit.pagina });
  if (filled(hit.popup)) lines.push({ label: "Pop-up", value: hit.popup });
  if (filled(hit.caminho)) lines.push({ label: "Agrupamento", value: hit.caminho });
  lines.push({ label: "Uso", value: hit.tipoUso });
  if (filled(hit.acao)) lines.push({ label: "Ação", value: hit.acao });
  if (filled(hit.coluna)) lines.push({ label: "Coluna", value: hit.coluna, code: true });
  if (filled(hit.valor)) lines.push({ label: "Valor", value: hit.valor, code: true });
  if (hit.oculto === "Sim" || hit.oculto === "Condicional") lines.push({ label: "Oculto", value: hit.motivoOculto ? `${hit.oculto} — ${hit.motivoOculto}` : hit.oculto });
  return lines;
}

/** Walks the hits in order, emitting a heading only when a level changes from the previous hit —
 *  so consecutive occurrences in the same passo share one heading block. */
function walkGrouped(hits: FieldSearchHit[], onHeading: (level: Level, depth: number) => void, onHit: (hit: FieldSearchHit, depth: number) => void) {
  let previous: Level[] = [];
  for (const hit of hits) {
    const levels = levelsOf(hit);
    let common = 0;
    while (common < levels.length && common < previous.length && levels[common].label === previous[common].label && levels[common].value === previous[common].value) common++;
    for (let depth = common; depth < levels.length; depth++) onHeading(levels[depth], depth);
    onHit(hit, levels.length);
    previous = levels;
  }
}

function escapeMarkdown(text: string): string {
  return text.replace(/([\\`*_])/g, "\\$1");
}

function codeSpan(text: string): string {
  return text.includes("`") ? escapeMarkdown(text) : `\`${text}\``;
}

/** Shaped for pasting into Discord: headings stop at `###` (Discord renders no deeper), so the
 *  third grouping level onwards becomes a bold line; no blank lines between lines. */
export function hitsToMarkdown(hits: FieldSearchHit[], termo: string): string {
  const out: string[] = [`# Busca de campos PS — "${escapeMarkdown(termo)}"`, hits.length === 1 ? "1 elemento encontrado" : `${hits.length} elementos encontrados`];
  walkGrouped(
    hits,
    (level, depth) => {
      const text = `${level.label}: ${escapeMarkdown(level.value)}`;
      out.push(depth < 2 ? `${"#".repeat(depth + 2)} ${text}` : `**${text}**`);
    },
    (hit) => {
      out.push(`- **Componente:** ${escapeMarkdown(componenteLabel(hit))}`);
      for (const line of detailLines(hit)) out.push(`  - **${line.label}:** ${line.code ? codeSpan(line.value) : escapeMarkdown(line.value)}`);
    }
  );
  return out.join("\n") + "\n";
}

export function hitsToText(hits: FieldSearchHit[], termo: string): string {
  const out: string[] = [`BUSCA DE CAMPOS PS — "${termo}" (${hits.length} ocorrência(s))`];
  walkGrouped(
    hits,
    (level, depth) => {
      if (depth === 0) out.push("");
      out.push(`${"  ".repeat(depth)}${level.label}: ${level.value}`);
    },
    (hit, depth) => {
      const indent = "  ".repeat(depth);
      out.push(`${indent}• ${componenteLabel(hit)}`);
      for (const line of detailLines(hit)) out.push(`${indent}    ${line.label}: ${line.value}`);
    }
  );
  return out.join("\n") + "\n";
}

/** One row per occurrence, same columns (and order) as the table on screen. */
export function hitsToSheetRows(hits: FieldSearchHit[], options: { includePortal: boolean }): Record<string, string | number>[] {
  return hits.map((h) => {
    const row: Record<string, string | number> = {};
    if (options.includePortal) row["Portal"] = h.portal;
    row["Processo"] = h.processo;
    row["Etapa"] = h.etapa ?? "";
    row["Passo"] = h.passo ?? "";
    row["Feedback"] = h.feedback ?? "";
    row["Página"] = h.pagina ?? "";
    row["Pop-up"] = h.popup ?? "";
    row["Campo / componente"] = componenteLabel(h);
    row["Categoria"] = h.categoria;
    row["ID do campo"] = h.fieldId ?? "";
    row["Agrupamento"] = h.caminho ?? "";
    row["Tipo de uso"] = h.tipoUso;
    row["Ação"] = h.acao ?? "";
    row["Coluna"] = h.coluna ?? "";
    row["Valor"] = h.valor ?? "";
    row["Detalhe"] = h.detalheUso ?? "";
    row["Oculto"] = h.oculto;
    row["Motivo oculto"] = h.motivoOculto ?? "";
    return row;
  });
}
