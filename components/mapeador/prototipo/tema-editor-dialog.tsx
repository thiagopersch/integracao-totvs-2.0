"use client"

import { useState } from "react"
import { toast } from "sonner"
import { Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { ImageInput } from "@/components/mapeador/image-input"
import { createMapeadorTema, updateMapeadorTema } from "@/actions/mapeador-tema"
import { MAPEADOR_TEMA_PADRAO_CONFIG } from "@/lib/mapeador/tema-defaults"
import type { MapeadorTemaConfig, MapeadorTemaDTO } from "@/types/mapeador"

interface TemaEditorDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  tema?: MapeadorTemaDTO | null
  onSaved: (tema: MapeadorTemaDTO) => void
}

const DEFAULT_CONFIG = MAPEADOR_TEMA_PADRAO_CONFIG

export function TemaEditorDialog({ open, onOpenChange, tema, onSaved }: TemaEditorDialogProps) {
  const [nome, setNome] = useState(tema?.nome ?? "")
  const [config, setConfig] = useState<MapeadorTemaConfig>(tema?.config ?? DEFAULT_CONFIG)
  const [loading, setLoading] = useState(false)
  // The org's baseline tema is found by this exact name (`mapeadorTemaService.getOrCreatePadrao`)
  // — renaming it would orphan it and silently spawn a fresh "Padrão" next time it's needed.
  const isPadrao = tema?.nome === "Padrão"

  function patch(p: Partial<MapeadorTemaConfig>) {
    setConfig((prev) => ({ ...prev, ...p }))
  }

  async function handleSave() {
    if (!nome.trim()) return
    setLoading(true)
    try {
      const result = tema ? await updateMapeadorTema(tema.id, { nome, config }) : await createMapeadorTema(nome, config)
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

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Cor da marca</Label>
              <Input type="color" value={config.corMarca} onChange={(e) => patch({ corMarca: e.target.value })} className="h-8 w-full p-1" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Cor da barra</Label>
              <Input type="color" value={config.corBarra} onChange={(e) => patch({ corBarra: e.target.value })} className="h-8 w-full p-1" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Cor do botão</Label>
              <Input type="color" value={config.botaoCor} onChange={(e) => patch({ botaoCor: e.target.value })} className="h-8 w-full p-1" />
            </div>
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

          <div className="flex gap-4">
            <ImageInput label="Logo" value={config.logoUrl} onChange={(url) => patch({ logoUrl: url })} kind="logo" />
            <ImageInput label="Imagem de fundo" value={config.bgImageUrl} onChange={(url) => patch({ bgImageUrl: url })} hint="Recomendado: pelo menos 1600×1000px, paisagem" kind="background" />
          </div>
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
