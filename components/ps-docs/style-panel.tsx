"use client"

import { Field, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { FONT_OPTIONS, type StyleConfig } from "@/lib/ps-docs/types"

interface StylePanelProps {
  style: StyleConfig
  onChange: (style: StyleConfig) => void
}

export function StylePanel({ style, onChange }: StylePanelProps) {
  function update<K extends keyof StyleConfig>(key: K, value: StyleConfig[K]) {
    onChange({ ...style, [key]: value })
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm">Estilização</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <Field>
            <FieldLabel htmlFor="titleColor">Cor do título</FieldLabel>
            <Input id="titleColor" type="color" className="h-10 p-1" value={style.titleColor} onChange={(e) => update("titleColor", e.target.value)} />
          </Field>
          <Field>
            <FieldLabel htmlFor="titleFont">Fonte do título</FieldLabel>
            <Select value={style.titleFont} onValueChange={(v) => v && update("titleFont", v)}>
              <SelectTrigger id="titleFont" className="w-full">
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
        </div>

        <div className="grid grid-cols-2 gap-4">
          <Field>
            <FieldLabel htmlFor="stageColor">Cor de &quot;Etapa&quot;</FieldLabel>
            <Input id="stageColor" type="color" className="h-10 p-1" value={style.stageColor} onChange={(e) => update("stageColor", e.target.value)} />
          </Field>
          <Field>
            <FieldLabel htmlFor="subheadingColor">Cor dos subtítulos</FieldLabel>
            <Input id="subheadingColor" type="color" className="h-10 p-1" value={style.subheadingColor} onChange={(e) => update("subheadingColor", e.target.value)} />
          </Field>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <Field>
            <FieldLabel htmlFor="bodyColor">Cor do corpo de texto</FieldLabel>
            <Input id="bodyColor" type="color" className="h-10 p-1" value={style.bodyColor} onChange={(e) => update("bodyColor", e.target.value)} />
          </Field>
          <Field>
            <FieldLabel htmlFor="bodyFont">Fonte do corpo de texto</FieldLabel>
            <Select value={style.bodyFont} onValueChange={(v) => v && update("bodyFont", v)}>
              <SelectTrigger id="bodyFont" className="w-full">
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
        </div>

        <p className="text-xs text-muted-foreground">
          A estilização é aplicada automaticamente no título, nas etapas, subtítulos e corpo do texto — na prévia, no arquivo .docx e na cópia
          para o Google Docs. O Markdown exportado é apenas estrutural (não suporta cor/fonte).
        </p>
      </CardContent>
    </Card>
  )
}
