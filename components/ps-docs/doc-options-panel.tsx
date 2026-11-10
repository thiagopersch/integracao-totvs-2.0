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
import { Layers, ListTree, MousePointerClick, TextCursorInput } from "lucide-react"
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

/** The "Conteúdo da documentação" questions. The detail switches only change how the document is
 *  rendered, so they can be flipped after generating too; the scope changes what gets fetched. */
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
      {QUESTIONS.map((q) => {
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
  if (!o.detalhesComponentes) parts.push("componentes em lista")
  if (!o.detalhesCampos) parts.push("campos em lista")
  if (!o.detalhesAcoesBotao) parts.push("ações em lista")
  return parts.join(" · ")
}
