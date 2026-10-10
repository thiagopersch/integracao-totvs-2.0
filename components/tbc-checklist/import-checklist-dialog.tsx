"use client"

import { useEffect, useState } from "react"
import { AlertTriangle, Loader2 } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Combobox } from "@/components/ui/combobox"
import { Field, FieldLabel } from "@/components/ui/field"
import { Label } from "@/components/ui/label"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { Skeleton } from "@/components/ui/skeleton"
import { Dialog, DialogBody, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { importTbcChecklistStructure, listTbcChecklistImportSources } from "@/actions/integrations/tbc-checklist-templates"
import type { TbcChecklistImportSource, TbcChecklistView } from "@/services/tbc-checklist.service"

type ImportMode = "merge" | "replace"

interface ImportChecklistDialogProps {
  /** Checklist receiving the structure — never offered as a source. */
  target: TbcChecklistView
  onOpenChange: (open: boolean) => void
  onImported: (checklist: TbcChecklistView, source: TbcChecklistImportSource) => void
}

const plural = (count: number, one: string, many: string) => `${count} ${count === 1 ? one : many}`

/**
 * Copies the Data Servers/fields of another checklist (any TBC the user can reach) into `target`.
 * When the target already has a structure, the user picks whether to merge into it or replace it.
 * Mounted only while open, so every opening lists the sources fresh.
 */
export function ImportChecklistDialog({ target, onOpenChange, onImported }: ImportChecklistDialogProps) {
  const [sources, setSources] = useState<TbcChecklistImportSource[] | null>(null)
  const [sourceId, setSourceId] = useState("")
  const [mode, setMode] = useState<ImportMode>("merge")
  const [importing, setImporting] = useState(false)

  useEffect(() => {
    let cancelled = false
    void listTbcChecklistImportSources(target.id).then((result) => {
      if (cancelled) return
      if (!result.success) {
        toast.error(result.error)
        setSources([])
        return
      }
      setSources(result.data.filter((s) => s.id !== target.id))
    })
    return () => {
      cancelled = true
    }
  }, [target.id])

  const source = sources?.find((s) => s.id === sourceId)
  const targetHasStructure = target.dataservers.length > 0

  async function handleImport() {
    if (!source) return
    setImporting(true)
    const result = await importTbcChecklistStructure(target.id, { sourceId: source.id, mode: targetHasStructure ? mode : "replace" })
    setImporting(false)
    if (!result.success) {
      toast.error(result.error)
      return
    }
    onImported(result.data, source)
  }

  return (
    <Dialog open onOpenChange={(open) => !importing && onOpenChange(open)}>
      <DialogContent className="h-auto max-h-[85vh] sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>Importar estrutura para &quot;{target.name}&quot;</DialogTitle>
        </DialogHeader>
        <DialogBody>
          <Field>
            <FieldLabel>Checklist de origem</FieldLabel>
            {sources === null ? (
              <Skeleton className="h-9 w-full" />
            ) : (
              <Combobox
                items={sources.map((s) => ({ value: s.id, label: `${s.name} — ${s.tbcName} (${s.clientName})` }))}
                value={sourceId}
                onValueChange={setSourceId}
                placeholder={sources.length ? "Selecione um checklist" : "Nenhum outro checklist disponível"}
                searchPlaceholder="Buscar por checklist, TBC ou cliente..."
                emptyText="Nenhum checklist encontrado."
                disabled={!sources.length}
              />
            )}
            {source && (
              <p className="text-xs text-muted-foreground">
                {plural(source.dataserverCount, "Data Server", "Data Servers")} · {plural(source.fieldCount, "campo", "campos")}
              </p>
            )}
          </Field>

          {targetHasStructure && (
            <Field>
              <FieldLabel>Este checklist já tem {plural(target.dataservers.length, "Data Server", "Data Servers")}. Como importar?</FieldLabel>
              <RadioGroup value={mode} onValueChange={(v) => setMode(v as ImportMode)}>
                <div className="flex items-start gap-2">
                  <RadioGroupItem value="merge" id="import-merge" className="mt-0.5" />
                  <Label htmlFor="import-merge" className="flex flex-col items-start gap-0.5 font-normal">
                    <span className="font-medium">Mesclar</span>
                    <span className="text-xs text-muted-foreground">
                      Adiciona os Data Servers que faltam e junta os campos dos que já existem. Nada deste checklist é perdido.
                    </span>
                  </Label>
                </div>
                <div className="flex items-start gap-2">
                  <RadioGroupItem value="replace" id="import-replace" className="mt-0.5" />
                  <Label htmlFor="import-replace" className="flex flex-col items-start gap-0.5 font-normal">
                    <span className="font-medium">Substituir</span>
                    <span className="text-xs text-muted-foreground">Troca a estrutura deste checklist pela do checklist de origem.</span>
                  </Label>
                </div>
              </RadioGroup>
              {mode === "replace" && (
                <p className="flex items-center gap-2 text-xs text-destructive">
                  <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
                  Os Data Servers e campos atuais deste checklist serão apagados.
                </p>
              )}
            </Field>
          )}

          <p className="text-xs text-muted-foreground">
            O contexto (coligada, filial, tipo de curso) e a configuração da listagem de processos só são copiados se este checklist
            ainda não tiver um contexto salvo.
          </p>
        </DialogBody>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={importing}>
            Cancelar
          </Button>
          <Button type="button" onClick={() => void handleImport()} disabled={!source || importing}>
            {importing && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Importar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
