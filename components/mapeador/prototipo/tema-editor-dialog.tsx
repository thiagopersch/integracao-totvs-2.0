"use client"

import { useEffect, useState } from "react"
import { toast } from "sonner"
import { Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { ImageInput } from "@/components/mapeador/image-input"
import { createMapeadorTema, updateMapeadorTema, listClientesParaTema, getClienteVisualIdentity } from "@/actions/mapeador-tema"
import { MAPEADOR_TEMA_PADRAO_CONFIG } from "@/lib/mapeador/tema-defaults"
import { cn } from "@/lib/utils"
import type { MapeadorTemaConfig, MapeadorTemaDTO } from "@/types/mapeador"

interface TemaEditorDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  tema?: MapeadorTemaDTO | null
  onSaved: (tema: MapeadorTemaDTO) => void
}

interface ClienteOption {
  id: string
  name: string
  image: string | null
  background: string | null
  color: string
}

const DEFAULT_CONFIG = MAPEADOR_TEMA_PADRAO_CONFIG

export function TemaEditorDialog({ open, onOpenChange, tema, onSaved }: TemaEditorDialogProps) {
  const [nome, setNome] = useState(tema?.nome ?? "")
  const [config, setConfig] = useState<MapeadorTemaConfig>(tema?.config ?? DEFAULT_CONFIG)
  const [loading, setLoading] = useState(false)
  const [clientes, setClientes] = useState<ClienteOption[]>([])
  // The org's baseline tema is found by this exact name (`mapeadorTemaService.getOrCreatePadrao`)
  // — renaming it would orphan it and silently spawn a fresh "Padrão" next time it's needed.
  const isPadrao = tema?.nome === "Padrão"
  const origem = config.origem ?? "manual"

  useEffect(() => {
    if (!open) return
    listClientesParaTema().then((data) => setClientes(data as ClienteOption[]))
  }, [open])

  function patch(p: Partial<MapeadorTemaConfig>) {
    setConfig((prev) => ({ ...prev, ...p }))
  }

  function handleOrigemChange(next: "manual" | "cliente") {
    if (next === origem) return
    patch(next === "manual" ? { origem: "manual", clienteId: null } : { origem: "cliente" })
  }

  function handleClienteChange(clienteId: string) {
    const cliente = clientes.find((c) => c.id === clienteId)
    if (!cliente) return
    patch({ clienteId: cliente.id, corMarca: cliente.color, corBarra: cliente.color, botaoCor: cliente.color, logoUrl: cliente.image, bgImageUrl: cliente.background })
  }

  async function handleSave() {
    if (!nome.trim()) return
    setLoading(true)
    try {
      // Re-fetch instead of trusting the state snapshotted when the client was picked — the
      // client's registration may have changed while this dialog was still open, and "salvar
      // tema" is the point where the client's current visual identity should be committed.
      let finalConfig = config
      if (config.origem === "cliente" && config.clienteId) {
        const cliente = await getClienteVisualIdentity(config.clienteId)
        if (cliente) {
          finalConfig = { ...config, corMarca: cliente.color, corBarra: cliente.color, botaoCor: cliente.color, logoUrl: cliente.image, bgImageUrl: cliente.background }
        }
      }
      const result = tema ? await updateMapeadorTema(tema.id, { nome, config: finalConfig }) : await createMapeadorTema(nome, finalConfig)
      if (!result.success) {
        toast.error(result.error || "Erro ao salvar tema")
        return
      }
      onSaved(result.data)
      onOpenChange(false)
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{isPadrao ? "Editar tema padrão" : tema ? "Editar tema" : "Criar novo tema"}</DialogTitle>
        </DialogHeader>
        <DialogBody className="space-y-4">
          <div className="space-y-1">
            <Label>Nome do tema</Label>
            <Input value={nome} onChange={(e) => setNome(e.target.value)} placeholder="Ex: UNISINOS" disabled={isPadrao} />
          </div>

          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">Origem da identidade visual</Label>
            <div className="flex overflow-hidden rounded-md border w-fit">
              <button
                type="button"
                className={cn("px-3 py-1 text-sm", origem === "manual" ? "bg-primary text-primary-foreground" : "bg-background")}
                onClick={() => handleOrigemChange("manual")}
              >
                Anexar imagem agora
              </button>
              <button
                type="button"
                className={cn("px-3 py-1 text-sm", origem === "cliente" ? "bg-primary text-primary-foreground" : "bg-background")}
                onClick={() => handleOrigemChange("cliente")}
              >
                Cliente
              </button>
            </div>
          </div>

          {origem === "cliente" ? (
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Cliente</Label>
              <Select
                items={clientes.map((c) => ({ value: c.id, label: c.name }))}
                value={config.clienteId ?? null}
                onValueChange={(v) => v && handleClienteChange(v as string)}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Selecione um cliente" />
                </SelectTrigger>
                <SelectContent>
                  {clientes.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {config.clienteId && (
                <div className="mt-2 flex items-center gap-3 rounded-md border p-2">
                  <span className="h-6 w-6 shrink-0 rounded border" style={{ backgroundColor: config.corMarca }} />
                  {config.logoUrl && <img src={config.logoUrl} alt="Logo do cliente" className="h-8 w-auto" />}
                  {config.bgImageUrl && <img src={config.bgImageUrl} alt="Imagem de fundo do cliente" className="h-8 w-14 rounded object-cover" />}
                  <span className="text-xs text-muted-foreground">Cor, logo e imagem de fundo herdados do cliente selecionado.</span>
                </div>
              )}
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">Cor da marca</Label>
                <Input type="color" value={config.corMarca} onChange={(e) => patch({ corMarca: e.target.value })} className="h-8 w-full p-1" />
              </div>
            </div>
          )}

          <div className="grid grid-cols-2 gap-4">
            {origem === "manual" && (
              <>
                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground">Cor da barra</Label>
                  <Input type="color" value={config.corBarra} onChange={(e) => patch({ corBarra: e.target.value })} className="h-8 w-full p-1" />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground">Cor do botão</Label>
                  <Input type="color" value={config.botaoCor} onChange={(e) => patch({ botaoCor: e.target.value })} className="h-8 w-full p-1" />
                </div>
              </>
            )}
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Raio da borda do botão (px)</Label>
              <Input type="number" min={0} max={30} value={config.botaoRaio ?? 5} onChange={(e) => patch({ botaoRaio: Number(e.target.value) })} />
            </div>
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Cor de fundo do campo</Label>
              <Input value={config.campoCor ?? ""} onChange={(e) => patch({ campoCor: e.target.value })} placeholder="rgba(0,0,0,.04)" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Raio da borda do campo (px)</Label>
              <Input type="number" min={0} max={30} value={config.campoRaio ?? 0} onChange={(e) => patch({ campoRaio: Number(e.target.value) })} />
            </div>
          </div>

          {origem === "manual" && (
            <div className="flex gap-4">
              <ImageInput label="Logo" value={config.logoUrl} onChange={(url) => patch({ logoUrl: url })} kind="logo" />
              <ImageInput label="Imagem de fundo" value={config.bgImageUrl} onChange={(url) => patch({ bgImageUrl: url })} hint="Recomendado: pelo menos 1600×1000px, paisagem" kind="background" />
            </div>
          )}
        </DialogBody>
        <DialogFooter>
          <Button onClick={handleSave} disabled={loading || !nome.trim()}>
            {loading && <Loader2 className="h-4 w-4 animate-spin" />} Salvar tema
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
