import { buildTrilhaRow } from "./logic-trail-format";
import { logicColor } from "./logic-color";
import { DEFAULT_STYLE, type LogicTrailDoc, type StyleConfig } from "./types";

function colorValue(value: string, style: StyleConfig): string {
  const color = logicColor(value, style);
  return color ? `<span style="color:${color}">${value}</span>` : value;
}

/** Plain structural Markdown for the "Trilhas de lógica" documentation — one block per trail,
 *  always "Início" (breadcrumb) → "Meio" (regras+condição, ou a fonte de dados) → "Fim" (elemento
 *  afetado/alimentado), in the order the elements appear in the builder. Mirrors the "ficha"
 *  format already used by `documentToMarkdown` for display-logic rules. */
export function logicTrailToMarkdown(doc: LogicTrailDoc, style: StyleConfig = DEFAULT_STYLE): string {
  const lines: string[] = [`# Trilhas de lógica — ${doc.tituloPortal}`, ""];

  if (doc.trilhas.length === 0) {
    lines.push("Nenhuma lógica de exibição/ação ou origem de dados identificada.", "");
    return lines.join("\n");
  }

  for (const entry of doc.trilhas) {
    const row = buildTrilhaRow(entry);
    lines.push(`## ${row.tipoLabel}`, "");
    lines.push(`- Início: **${row.breadcrumb}**`);
    if (row.acao !== undefined) {
      lines.push(`- Meio: Ação **${colorValue(row.acao, style)}** → Condição: **${row.condicao}**`);
      for (const r of row.regras ?? []) {
        lines.push(`  - ${r.campo} → **${r.regra}**${r.valor !== undefined ? ` → **${r.valor}**` : ""}`);
      }
    } else {
      for (const l of row.meioLines) lines.push(`- ${l.label}: **${colorValue(l.value, style)}**`);
      if (row.parametros && row.parametros.length > 0) {
        lines.push("- Parâmetros:");
        for (const p of row.parametros) lines.push(p.detalhe ? `  - ${p.nome}: **${p.detalhe}**` : `  - ${p.nome}`);
      }
    }
    lines.push(`- Fim: **${row.elemento}**`, "", "---", "");
  }

  return lines.join("\n").trim() + "\n";
}
