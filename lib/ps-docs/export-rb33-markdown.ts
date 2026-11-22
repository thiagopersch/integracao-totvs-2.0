import { RB33_SECTION, buildRb33Doc, isGrupoOculto, type Rb33Item } from "./rb33-format";
import { DEFAULT_DOC_OPTIONS, type DocOptions, type DocumentacaoPS } from "./types";

/** Markdown for the "Resumido (RB-33)" model — ".md" download and the `text/plain` fallback of
 *  "Copiar para Google Docs". */

const cell = (t: string) => t.replace(/\|/g, "\\|").replace(/\n/g, "<br>");

export function rb33ToMarkdown(doc: DocumentacaoPS, opts: DocOptions = DEFAULT_DOC_OPTIONS): string {
  const d = buildRb33Doc(doc, opts);
  const out: string[] = [`# ${d.titulo}`, ""];
  if (d.subtitulo) out.push(`\`${d.subtitulo}\``, "");

  for (const e of d.etapas) {
    out.push(`## Etapa: ${e.nome}`, "");
    if (e.idLinha) out.push(`\`${e.idLinha}\``, "");
    if (e.fonteDados) out.push(`_Fonte de dados da etapa: ${e.fonteDados}_`, "");

    out.push(`**${RB33_SECTION.logica}**`, "", e.logica.join("  \n"), "");
    out.push(`**${RB33_SECTION.descricao}**`, "", e.descricao, "");

    out.push(`**${RB33_SECTION.passos}**`, "");
    for (const p of e.passos) {
      out.push(`### Passo: ${p.nome}`, "");
      if (p.fonteDados) out.push(`_Fonte de dados do passo: ${p.fonteDados}_`, "");
      if (p.itens.length === 0) out.push("_Nenhum campo neste passo._", "");
      const item = (i: Rb33Item, prefix = "") => {
        const tag = i.tag ? `\`${i.tag}\` ` : "";
        const cond = i.cond ? ` — _${i.cond}_` : "";
        out.push(`${prefix}- ${tag}**${i.nome}**${i.obrigatorio ? " \\*" : ""}${cond}`);
        for (const n of i.notas) {
          out.push(`${prefix}  - ${n.texto}`);
          if (n.codigo) out.push(prefix, `${prefix}    \`\`\`js`, ...n.codigo.split("\n").map((l) => `${prefix}    ${l}`), `${prefix}    \`\`\``, prefix);
        }
      };
      for (const entry of p.itens) {
        if (!isGrupoOculto(entry)) {
          item(entry);
          continue;
        }
        out.push("", `> **${entry.titulo}**  `, `> _Identificado por: ${entry.motivo}${entry.cond ? ` · agrupamento ${entry.cond}` : ""}_`, ">");
        if (entry.itens.length === 0) out.push("> _Agrupamento sem campos._");
        for (const i of entry.itens) item(i, "> ");
        out.push("");
      }
      out.push("");
    }

    out.push(`**${RB33_SECTION.feedbacks}**`, "");
    if (e.feedbacks.length === 0) out.push("_Nenhum feedback configurado._");
    for (const f of e.feedbacks) out.push(`- **${f.rotulo.trim()}** ${f.texto.replace(/\n/g, " ")}`);
    out.push("");

    out.push(`**${RB33_SECTION.acoes}** _(${RB33_SECTION.acoesHint})_`, "");
    if (e.botoes.length === 0) out.push(`_${RB33_SECTION.semAcoes}_`, "");
    for (const b of e.botoes) {
      out.push(`**${b.titulo}**${b.cond ? ` — _botão ${b.cond}_` : ""}`, "");
      out.push(`| ${RB33_SECTION.colunas.join(" | ")} |`, "| --- | --- | --- |");
      for (const l of b.linhas) {
        const desc = [l.titulo ? `**${l.titulo}**` : "", l.descricao ?? "", l.queryCode ? `\`(${l.queryCode})\`` : ""].filter(Boolean).join(" ");
        out.push(`| ${cell(l.tipo)} | ${cell(desc)} | ${cell(l.logica ?? "—")} |`);
      }
      out.push("");
    }
    out.push(`**${RB33_SECTION.notas}**`, "", "", "---", "");
  }
  return out.join("\n");
}
