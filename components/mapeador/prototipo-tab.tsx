"use client"

import { useMemo, useState } from "react"
import { toast } from "sonner"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Checkbox } from "@/components/ui/checkbox"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { updateMapeadorPrototipoConfig } from "@/actions/mapeador"
import { useMapeadorStore } from "@/store/mapeador.store"
import { cn } from "@/lib/utils"
import type { MapeadorCampo } from "@/types/mapeador"

const TEMAS = [
  { value: "padrao", label: "Padrão" },
  { value: "escuro", label: "Escuro" },
]

function isVoltarButton(label: string) {
  return /voltar/i.test(label)
}

export function PrototipoTab() {
  const projeto = useMapeadorStore((s) => s.projeto)!
  const patchPrototipoConfig = useMapeadorStore((s) => s.patchPrototipoConfig)
  const [etapaIndex, setEtapaIndex] = useState(0)
  const [passoIndex, setPassoIndex] = useState(0)
  const [values, setValues] = useState<Record<string, unknown>>({})
  const [errors, setErrors] = useState<Set<string>>(new Set())
  const [finished, setFinished] = useState(false)

  const config = projeto.prototipoConfig
  const visualizacao = config.visualizacao ?? "desktop"
  const corMarca = config.corMarca || "#0d9488"
  const corBarra = config.corBarra || "#ffffff"

  const etapa = projeto.etapas[etapaIndex] ?? null
  const passo = etapa?.camposPorEtapa[passoIndex] ?? null

  const etapaIndexById = useMemo(() => new Map(projeto.etapas.map((e, i) => [e.id, i])), [projeto.etapas])

  function saveConfig(patch: Partial<typeof config>) {
    patchPrototipoConfig(patch)
    updateMapeadorPrototipoConfig(projeto.id, { ...config, ...patch }).then((result) => {
      if (!result.success) toast.error(result.error || "Erro ao salvar configuração do protótipo")
    })
  }

  function setValue(campoId: string, value: unknown) {
    setValues((prev) => ({ ...prev, [campoId]: value }))
    setErrors((prev) => {
      if (!prev.has(campoId)) return prev
      const next = new Set(prev)
      next.delete(campoId)
      return next
    })
  }

  function goToEtapaPasso(etapaIdx: number, passoIdx: number) {
    setEtapaIndex(etapaIdx)
    setPassoIndex(passoIdx)
    setFinished(false)
  }

  function advance(destinoEtapaId?: string | null) {
    if (destinoEtapaId) {
      const idx = etapaIndexById.get(destinoEtapaId)
      if (idx !== undefined) return goToEtapaPasso(idx, 0)
    }
    if (!etapa) return
    if (passoIndex < etapa.camposPorEtapa.length - 1) return goToEtapaPasso(etapaIndex, passoIndex + 1)
    if (etapaIndex < projeto.etapas.length - 1) return goToEtapaPasso(etapaIndex + 1, 0)
    setFinished(true)
  }

  function goBack() {
    if (passoIndex > 0) return goToEtapaPasso(etapaIndex, passoIndex - 1)
    if (etapaIndex > 0) {
      const prevEtapa = projeto.etapas[etapaIndex - 1]
      return goToEtapaPasso(etapaIndex - 1, Math.max(prevEtapa.camposPorEtapa.length - 1, 0))
    }
  }

  function handleBotaoClick(campo: MapeadorCampo) {
    if (isVoltarButton(campo.label)) return goBack()

    const camposObrigatorios = (passo?.campos ?? []).filter(
      (c) => c.obrigatorio && !["botao", "texto_informativo", "titulo_pagina", "label_destaque", "divisor"].includes(c.tipo)
    )
    const missing = camposObrigatorios.filter((c) => {
      const v = values[c.id]
      return v === undefined || v === "" || (Array.isArray(v) && v.length === 0)
    })
    if (missing.length > 0) {
      setErrors(new Set(missing.map((c) => c.id)))
      toast.error("Preencha os campos obrigatórios antes de avançar.")
      return
    }
    advance(campo.acaoDestinoEtapaId)
  }

  function renderCampo(campo: MapeadorCampo) {
    const hasError = errors.has(campo.id)
    switch (campo.tipo) {
      case "titulo_pagina":
        return (
          <h3 key={campo.id} className="text-lg font-bold">
            {campo.label}
          </h3>
        )
      case "label_destaque":
        return (
          <p key={campo.id} className="font-semibold text-primary">
            {campo.label}
          </p>
        )
      case "texto_informativo":
        return (
          <p key={campo.id} className="text-sm text-muted-foreground">
            {campo.label}
          </p>
        )
      case "divisor":
        return <hr key={campo.id} className="my-2" />
      case "botao":
        return (
          <Button
            key={campo.id}
            variant={isVoltarButton(campo.label) ? "outline" : "default"}
            className="w-full"
            onClick={() => handleBotaoClick(campo)}
            style={!isVoltarButton(campo.label) ? { backgroundColor: corMarca } : undefined}
          >
            {campo.label.toUpperCase()}
          </Button>
        )
      case "select":
        return (
          <div key={campo.id} className="space-y-1">
            <Label className={cn(hasError && "text-destructive")}>
              {campo.label} {campo.obrigatorio && "*"}
            </Label>
            <Select items={(campo.opcoesLista ?? []).map((o) => ({ value: o, label: o }))} value={(values[campo.id] as string) ?? null} onValueChange={(v) => setValue(campo.id, v)}>
              <SelectTrigger className={cn("w-full", hasError && "border-destructive")}>
                <SelectValue placeholder="Selecione..." />
              </SelectTrigger>
              <SelectContent>
                {(campo.opcoesLista ?? []).map((o) => (
                  <SelectItem key={o} value={o}>
                    {o}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )
      case "radio":
        return (
          <div key={campo.id} className="space-y-1">
            <Label className={cn(hasError && "text-destructive")}>
              {campo.label} {campo.obrigatorio && "*"}
            </Label>
            <RadioGroup value={(values[campo.id] as string) ?? ""} onValueChange={(v) => setValue(campo.id, v)}>
              {(campo.opcoesLista ?? []).map((o) => (
                <Label key={o} className="flex items-center gap-2 font-normal">
                  <RadioGroupItem value={o} /> {o}
                </Label>
              ))}
            </RadioGroup>
          </div>
        )
      case "check":
        if (campo.opcoesLista?.length) {
          const selected = (values[campo.id] as string[]) ?? []
          return (
            <div key={campo.id} className="space-y-1">
              <Label className={cn(hasError && "text-destructive")}>
                {campo.label} {campo.obrigatorio && "*"}
              </Label>
              {campo.opcoesLista.map((o) => (
                <Label key={o} className="flex items-center gap-2 font-normal">
                  <Checkbox
                    checked={selected.includes(o)}
                    onCheckedChange={(v) => setValue(campo.id, v ? [...selected, o] : selected.filter((s) => s !== o))}
                  />
                  {o}
                </Label>
              ))}
            </div>
          )
        }
        return (
          <Label key={campo.id} className="flex items-center gap-2 font-normal">
            <Checkbox checked={!!values[campo.id]} onCheckedChange={(v) => setValue(campo.id, !!v)} />
            {campo.label} {campo.obrigatorio && "*"}
          </Label>
        )
      case "data":
        return (
          <div key={campo.id} className="space-y-1">
            <Label className={cn(hasError && "text-destructive")}>
              {campo.label} {campo.obrigatorio && "*"}
            </Label>
            <Input type="date" value={(values[campo.id] as string) ?? ""} onChange={(e) => setValue(campo.id, e.target.value)} className={cn(hasError && "border-destructive")} />
          </div>
        )
      case "documento_upload":
        return (
          <div key={campo.id} className="space-y-1">
            <Label className={cn(hasError && "text-destructive")}>
              {campo.label} {campo.obrigatorio && "*"}
            </Label>
            <Input type="file" onChange={(e) => setValue(campo.id, e.target.files?.[0]?.name ?? "")} className={cn(hasError && "border-destructive")} />
          </div>
        )
      case "pagamento_valor":
        return (
          <div key={campo.id} className="rounded-md bg-muted p-3 text-center font-semibold">
            {campo.label}
          </div>
        )
      case "pagamento_formas":
      case "popup":
      case "condicional":
        return (
          <p key={campo.id} className="text-sm italic text-muted-foreground">
            {campo.label}
          </p>
        )
      default:
        return (
          <div key={campo.id} className="space-y-1">
            <Label className={cn(hasError && "text-destructive")}>
              {campo.label} {campo.obrigatorio && "*"}
            </Label>
            <Input value={(values[campo.id] as string) ?? ""} onChange={(e) => setValue(campo.id, e.target.value)} className={cn(hasError && "border-destructive")} />
          </div>
        )
    }
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="flex flex-wrap items-center gap-6 py-4">
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">Visualização</Label>
            <div className="flex overflow-hidden rounded-md border">
              <button
                className={cn("px-3 py-1 text-sm", visualizacao === "desktop" ? "bg-primary text-primary-foreground" : "bg-background")}
                onClick={() => saveConfig({ visualizacao: "desktop" })}
              >
                Desktop
              </button>
              <button
                className={cn("px-3 py-1 text-sm", visualizacao === "mobile" ? "bg-primary text-primary-foreground" : "bg-background")}
                onClick={() => saveConfig({ visualizacao: "mobile" })}
              >
                Mobile
              </button>
            </div>
          </div>
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">Tema</Label>
            <Select items={TEMAS} value={config.tema ?? "padrao"} onValueChange={(v) => saveConfig({ tema: v as string })}>
              <SelectTrigger className="w-36">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {TEMAS.map((t) => (
                  <SelectItem key={t.value} value={t.value}>
                    {t.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">Cor da marca</Label>
            <Input type="color" value={corMarca} onChange={(e) => saveConfig({ corMarca: e.target.value })} className="h-8 w-14 p-1" />
          </div>
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">Cor da barra</Label>
            <Input type="color" value={corBarra} onChange={(e) => saveConfig({ corBarra: e.target.value })} className="h-8 w-14 p-1" />
          </div>
        </CardContent>
      </Card>

      <div className="flex justify-center">
        <div
          className={cn("overflow-hidden rounded-lg border shadow-sm transition-all", visualizacao === "mobile" ? "w-[390px]" : "w-full max-w-3xl")}
        >
          <div className="flex items-center justify-between px-4 py-3" style={{ backgroundColor: corBarra }}>
            <span className="text-lg font-bold" style={{ color: corMarca }}>
              EXEMPLO
            </span>
            <span className="rounded-md border px-3 py-1 text-sm">LOGIN</span>
          </div>

          <div className="space-y-4 p-6">
            {finished ? (
              <div className="py-12 text-center">
                <p className="text-lg font-semibold">Fluxo concluído!</p>
                <p className="text-sm text-muted-foreground">O candidato percorreu todas as etapas mapeadas.</p>
                <Button className="mt-4" variant="outline" onClick={() => goToEtapaPasso(0, 0)}>
                  Reiniciar
                </Button>
              </div>
            ) : etapa && passo ? (
              <>
                <div className="flex flex-wrap gap-1 text-xs text-muted-foreground">
                  {projeto.etapas.map((e, i) => (
                    <span
                      key={e.id}
                      className={cn("rounded-full px-2 py-0.5", i === etapaIndex ? "font-semibold text-foreground" : "")}
                      style={i === etapaIndex ? { backgroundColor: `${corMarca}22`, color: corMarca } : undefined}
                    >
                      {i + 1}. {e.nome}
                    </span>
                  ))}
                </div>
                <h2 className="text-xl font-semibold">{passo.titulo}</h2>
                <div className="space-y-3">{passo.campos.map(renderCampo)}</div>
                {!passo.campos.some((c) => c.tipo === "botao") && (
                  <Button className="w-full" style={{ backgroundColor: corMarca }} onClick={() => handleBotaoClick({ id: "__auto__", tipo: "botao", label: "Avançar" })}>
                    AVANÇAR
                  </Button>
                )}
              </>
            ) : (
              <p className="text-sm text-muted-foreground">Nenhuma etapa com passos mapeados ainda. Vá até a aba Mapeamento para começar.</p>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
