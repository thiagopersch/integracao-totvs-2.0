"use client"

import { Field, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Switch } from "@/components/ui/switch"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { FONT_OPTIONS, type StyleConfig } from "@/lib/ps-docs/types"

interface StylePanelProps {
  style: StyleConfig
  onChange: (style: StyleConfig) => void
}

type ColorKey = "titleColor" | "stageColor" | "subheadingColor" | "bodyColor" | "positiveColor" | "negativeColor"
type FontKey = "titleFont" | "bodyFont"

const COLORS: { title: string; items: { key: ColorKey; label: string }[] }[] = [
  {
    title: "Cores do texto",
    items: [
      { key: "titleColor", label: "Título" },
      { key: "stageColor", label: 'Etapa' },
      { key: "subheadingColor", label: "Subtítulos" },
      { key: "bodyColor", label: "Corpo de texto" },
    ],
  },
  {
    title: "Cores de valores lógicos",
    items: [
      { key: "positiveColor", label: "Positivo (Sim / Ativado)" },
      { key: "negativeColor", label: "Negativo (Não / Desativado)" },
    ],
  },
]

const FONTS: { key: FontKey; label: string }[] = [
  { key: "titleFont", label: "Fonte do título" },
  { key: "bodyFont", label: "Fonte do corpo de texto" },
]

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-3 rounded-md border p-4">
      <h3 className="text-sm font-medium">{title}</h3>
      {children}
    </section>
  )
}

export function StylePanel({ style, onChange }: StylePanelProps) {
  function update<K extends keyof StyleConfig>(key: K, value: StyleConfig[K]) {
    onChange({ ...style, [key]: value })
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm">Estilização</CardTitle>
        <p className="text-xs text-muted-foreground">Vale para toda a documentação (portal e processos seletivos).</p>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
          {COLORS.map((group) => (
            <Section key={group.title} title={group.title}>
              <div className="grid grid-cols-2 gap-3">
                {group.items.map(({ key, label }) => (
                  <Field key={key}>
                    <FieldLabel htmlFor={key}>{label}</FieldLabel>
                    <Input id={key} type="color" className="h-10 p-1" value={style[key]} onChange={(e) => update(key, e.target.value)} />
                  </Field>
                ))}
              </div>
            </Section>
          ))}

          <Section title="Fontes">
            <div className="grid grid-cols-1 gap-3">
              {FONTS.map(({ key, label }) => (
                <Field key={key}>
                  <FieldLabel htmlFor={key}>{label}</FieldLabel>
                  <Select value={style[key]} onValueChange={(v) => v && update(key, v)}>
                    <SelectTrigger id={key} className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {FONT_OPTIONS.map((font) => (
                        <SelectItem key={font} value={font}>
                          {font}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </Field>
              ))}
            </div>
          </Section>
        </div>

        <Section title="Preview">
          <div className="flex items-center justify-between gap-4">
            <div className="space-y-0.5">
              <FieldLabel htmlFor="followAppTheme">Usar o mesmo tema do app no preview da documentação</FieldLabel>
              <p className="text-xs text-muted-foreground">Desligado: o preview é sempre claro, independente do tema do app.</p>
            </div>
            <Switch id="followAppTheme" checked={!!style.followAppTheme} onCheckedChange={(v) => update("followAppTheme", v)} />
          </div>
        </Section>

        <p className="text-xs text-muted-foreground">
          Aplicada na prévia, no .docx, na cópia para o Google Docs e no Markdown (neste, só a cor dos valores lógicos, via HTML inline).
        </p>
      </CardContent>
    </Card>
  )
}
