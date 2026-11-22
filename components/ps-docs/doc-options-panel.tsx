"use client"

import List from "@mui/material/List"
import ListItem from "@mui/material/ListItem"
import ListItemButton from "@mui/material/ListItemButton"
import ListItemIcon from "@mui/material/ListItemIcon"
import ListItemText from "@mui/material/ListItemText"
import ListSubheader from "@mui/material/ListSubheader"
import MuiSwitch from "@mui/material/Switch"
import ToggleButton from "@mui/material/ToggleButton"
import ToggleButtonGroup from "@mui/material/ToggleButtonGroup"
import Typography from "@mui/material/Typography"
import { Code2, LayoutList, Layers, ListTree, MousePointerClick, TextCursorInput } from "lucide-react"
import type { DocOptions } from "@/lib/ps-docs/types"

type DetailKey = "detalhesComponentes" | "detalhesCampos" | "detalhesAcoesBotao"

const QUESTIONS: { key: DetailKey; title: string; icon: React.ReactNode }[] = [
  { key: "detalhesComponentes", title: "Gerar detalhes dos componentes?", icon: <Layers className="h-5 w-5" /> },
  { key: "detalhesCampos", title: "Gerar detalhes dos campos?", icon: <TextCursorInput className="h-5 w-5" /> },
  { key: "detalhesAcoesBotao", title: "Gerar detalhes das ações do componente botão?", icon: <MousePointerClick className="h-5 w-5" /> },
]

const detailHint = (on: boolean) =>
  on ? "Sim — documentação completa, como hoje." : "Não — apenas os nomes, em lista de marcadores, mantendo a lógica."

interface DocOptionsPanelProps {
  value: DocOptions
  onChange: (value: DocOptions) => void
  /** The "apenas o portal / tudo" question only applies to the "Portal inteiro" mode. */
  showScope: boolean
}

/** The "Conteúdo da documentação" questions. The model and detail switches only change how the
 *  document is rendered, so they can be flipped after generating too; the scope changes what gets
 *  fetched. The three detail switches only exist in the "Detalhado" model. */
export function DocOptionsPanel({ value, onChange, showScope }: DocOptionsPanelProps) {
  const set = <K extends keyof DocOptions>(key: K, v: DocOptions[K]) => onChange({ ...value, [key]: v })

  return (
    <List
      disablePadding
      sx={{ border: 1, borderColor: "divider", borderRadius: 2, overflow: "hidden", bgcolor: "background.paper" }}
      subheader={
        <ListSubheader component="div" sx={{ lineHeight: 2.5, bgcolor: "transparent", position: "static" }}>
          Conteúdo da documentação
        </ListSubheader>
      }
    >
      <ListItem sx={{ flexWrap: "wrap", gap: 1.5, py: 1.5 }}>
        <ListItemIcon sx={{ minWidth: 40, color: "primary.main" }}>
          <LayoutList className="h-5 w-5" />
        </ListItemIcon>
        <ListItemText
          sx={{ flex: "1 1 220px" }}
          primary="Modelo da documentação"
          secondary={
            value.modelo === "resumido"
              ? "Resumido (RB-33): uma linha por campo, seções numeradas e uma tabela de ações por botão."
              : "Detalhado: a ficha completa de cada campo e componente."
          }
        />
        <ToggleButtonGroup
          exclusive
          size="small"
          color="primary"
          value={value.modelo}
          onChange={(_e, v: DocOptions["modelo"] | null) => v && set("modelo", v)}
          aria-label="Modelo da documentação"
        >
          <ToggleButton value="resumido">
            <Typography variant="button">Resumido (RB-33)</Typography>
          </ToggleButton>
          <ToggleButton value="detalhado">
            <Typography variant="button">Detalhado</Typography>
          </ToggleButton>
        </ToggleButtonGroup>
      </ListItem>

      {value.modelo === "resumido" && (
        <ListItem
          disablePadding
          secondaryAction={
            <MuiSwitch
              edge="end"
              checked={value.incluirCodigoScript}
              onChange={(_e, checked) => set("incluirCodigoScript", checked)}
              slotProps={{ input: { "aria-labelledby": "doc-opt-incluirCodigoScript" } }}
            />
          }
        >
          <ListItemButton onClick={() => set("incluirCodigoScript", !value.incluirCodigoScript)} sx={{ pr: 9 }}>
            <ListItemIcon sx={{ minWidth: 40, color: value.incluirCodigoScript ? "primary.main" : "text.secondary" }}>
              <Code2 className="h-5 w-5" />
            </ListItemIcon>
            <ListItemText
              id="doc-opt-incluirCodigoScript"
              primary="Incluir o código das validações por script?"
              secondary={
                value.incluirCodigoScript
                  ? "Sim — o texto interpretado e, abaixo, o código JavaScript."
                  : "Não — apenas o texto interpretado da regra."
              }
            />
          </ListItemButton>
        </ListItem>
      )}

      {value.modelo === "detalhado" && QUESTIONS.map((q) => {
        const on = value[q.key]
        const id = `doc-opt-${q.key}`
        return (
          <ListItem
            key={q.key}
            disablePadding
            secondaryAction={
              <MuiSwitch
                edge="end"
                checked={on}
                onChange={(_e, checked) => set(q.key, checked)}
                slotProps={{ input: { "aria-labelledby": id } }}
              />
            }
          >
            <ListItemButton onClick={() => set(q.key, !on)} sx={{ pr: 9 }}>
              <ListItemIcon sx={{ minWidth: 40, color: on ? "primary.main" : "text.secondary" }}>{q.icon}</ListItemIcon>
              <ListItemText id={id} primary={q.title} secondary={detailHint(on)} />
            </ListItemButton>
          </ListItem>
        )
      })}

      {showScope && (
        <ListItem sx={{ flexWrap: "wrap", gap: 1.5, py: 1.5 }}>
          <ListItemIcon sx={{ minWidth: 40, color: "primary.main" }}>
            <ListTree className="h-5 w-5" />
          </ListItemIcon>
          <ListItemText
            sx={{ flex: "1 1 220px" }}
            primary="Gerar documentação apenas do portal ou tudo?"
            secondary={
              value.escopoPortal === "portal"
                ? "Apenas a configuração do portal, sem os processos seletivos."
                : "Configuração do portal e todos os processos seletivos ativos."
            }
          />
          <ToggleButtonGroup
            exclusive
            size="small"
            color="primary"
            value={value.escopoPortal}
            onChange={(_e, v: DocOptions["escopoPortal"] | null) => v && set("escopoPortal", v)}
            aria-label="Escopo da documentação do portal"
          >
            <ToggleButton value="portal">
              <Typography variant="button">Apenas o portal</Typography>
            </ToggleButton>
            <ToggleButton value="tudo">
              <Typography variant="button">Tudo</Typography>
            </ToggleButton>
          </ToggleButtonGroup>
        </ListItem>
      )}
    </List>
  )
}

/** Short summary of the answers for the collapsed form header, e.g. "campos em lista". */
export function docOptionsSummary(o: DocOptions, portal: boolean): string {
  const parts: string[] = []
  if (portal && o.escopoPortal === "portal") parts.push("só portal")
  parts.push(o.modelo === "resumido" ? "modelo resumido (RB-33)" : "modelo detalhado")
  if (o.modelo === "resumido") {
    if (o.incluirCodigoScript) parts.push("com código dos scripts")
    return parts.join(" · ")
  }
  if (!o.detalhesComponentes) parts.push("componentes em lista")
  if (!o.detalhesCampos) parts.push("campos em lista")
  if (!o.detalhesAcoesBotao) parts.push("ações em lista")
  return parts.join(" · ")
}
