"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Bookmark, BookmarkPlus, ChevronDown, FolderOpen, Loader2, Star } from "lucide-react"
import { toast } from "@/lib/toast"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Field, FieldLabel } from "@/components/ui/field"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { saveSoapTemplate, toggleSoapFavorite, type SoapSavedCallInput } from "@/actions/soap"
import type { SoapBuilderSnapshot, SoapSavedCall } from "@/types/soap"

/** Same call = same endpoint type, method, TBC and catalog entry (mirrors `sameCall` in actions/soap.ts). */
export function isSameSoapCall(a: SoapBuilderSnapshot, b: SoapBuilderSnapshot | null): boolean {
  return (
    !!b &&
    a.typeId === b.typeId &&
    a.methodId === b.methodId &&
    a.tbcId === b.tbcId &&
    a.dataserverId === b.dataserverId &&
    a.processId === b.processId
  )
}

interface Props {
  favorites: SoapSavedCall[]
  templates: SoapSavedCall[]
  /** The builder's current call, or null while no type/method is selected. */
  current: Omit<SoapSavedCallInput, "name" | "description"> | null
  /** Suggested name for a new favorite/template (e.g. "ReadView · EduAlunoData"). */
  suggestedName: string
  onOpen: (call: SoapSavedCall) => void
}

/** Favoritar / Salvar template / Abrir — the SOAP builder's saved-calls controls. */
export function SoapSavedCallsBar({ favorites, templates, current, suggestedName, onOpen }: Props) {
  const router = useRouter()
  const [localFavorites, setLocalFavorites] = useState(favorites)
  const [localTemplates, setLocalTemplates] = useState(templates)
  const [syncedFrom, setSyncedFrom] = useState({ favorites, templates })
  // Server data wins whenever the page re-renders with new lists (router.refresh after a save).
  if (syncedFrom.favorites !== favorites || syncedFrom.templates !== templates) {
    setSyncedFrom({ favorites, templates })
    setLocalFavorites(favorites)
    setLocalTemplates(templates)
  }

  const [favoriting, setFavoriting] = useState(false)
  const [templateOpen, setTemplateOpen] = useState(false)
  const [templateName, setTemplateName] = useState("")
  const [templateDescription, setTemplateDescription] = useState("")
  const [savingTemplate, setSavingTemplate] = useState(false)

  const currentFavorite = current ? localFavorites.find((f) => isSameSoapCall(current.snapshot as SoapBuilderSnapshot, f.snapshot)) : undefined

  async function handleToggleFavorite() {
    if (!current) {
      toast.error("Selecione o tipo e o método antes de favoritar")
      return
    }
    setFavoriting(true)
    try {
      const result = await toggleSoapFavorite({ ...current, name: currentFavorite?.name ?? suggestedName })
      if (!result.success) {
        toast.error(result.error || "Erro ao favoritar")
        return
      }
      if (result.favorited) {
        setLocalFavorites((list) => [
          {
            id: result.id,
            kind: "favorite",
            name: suggestedName,
            description: null,
            xml: current.xml,
            snapshot: current.snapshot as SoapBuilderSnapshot,
          },
          ...list,
        ])
        toast.success("Adicionado aos favoritos")
      } else {
        setLocalFavorites((list) => list.filter((f) => f.id !== result.id))
        toast.success("Removido dos favoritos")
      }
      router.refresh()
    } finally {
      setFavoriting(false)
    }
  }

  function openTemplateDialog() {
    if (!current) {
      toast.error("Selecione o tipo e o método antes de salvar um template")
      return
    }
    setTemplateName(suggestedName)
    setTemplateDescription("")
    setTemplateOpen(true)
  }

  async function handleSaveTemplate() {
    if (!current) return
    if (!templateName.trim()) {
      toast.error("Informe um nome para o template")
      return
    }
    setSavingTemplate(true)
    try {
      const result = await saveSoapTemplate({ ...current, name: templateName, description: templateDescription })
      if (!result.success) {
        toast.error(result.error || "Erro ao salvar template")
        return
      }
      setLocalTemplates((list) =>
        [
          ...list,
          {
            id: result.id,
            kind: "template" as const,
            name: templateName.trim(),
            description: templateDescription.trim() || null,
            xml: current.xml,
            snapshot: current.snapshot as SoapBuilderSnapshot,
          },
        ].sort((a, b) => a.name.localeCompare(b.name, "pt-BR"))
      )
      toast.success("Template salvo")
      setTemplateOpen(false)
      router.refresh()
    } finally {
      setSavingTemplate(false)
    }
  }

  const hasSaved = localFavorites.length > 0 || localTemplates.length > 0

  return (
    <>
      <Tooltip>
        <TooltipTrigger
          render={
            <Button
              variant="outline"
              size="sm"
              aria-pressed={!!currentFavorite}
              disabled={favoriting}
              onClick={handleToggleFavorite}
            />
          }
        >
          {favoriting ? (
            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
          ) : (
            <Star className={currentFavorite ? "h-4 w-4 mr-2 fill-amber-400 text-amber-400" : "h-4 w-4 mr-2"} />
          )}
          {currentFavorite ? "Favoritado" : "Favoritar"}
        </TooltipTrigger>
        <TooltipContent>
          {currentFavorite ? "Remover esta chamada dos favoritos" : "Favoritar esta chamada (tipo, método, TBC e XML)"}
        </TooltipContent>
      </Tooltip>

      <Button variant="outline" size="sm" onClick={openTemplateDialog}>
        <BookmarkPlus className="h-4 w-4 mr-2" /> Salvar template
      </Button>

      <DropdownMenu>
        <DropdownMenuTrigger render={<Button variant="outline" size="sm" />}>
          <FolderOpen className="h-4 w-4 mr-2" /> Abrir <ChevronDown className="ml-1 h-4 w-4" />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="min-w-64 max-h-[60vh] overflow-y-auto">
          {!hasSaved && <DropdownMenuLabel>Nenhum favorito ou template salvo</DropdownMenuLabel>}
          {localFavorites.length > 0 && (
            <>
              <DropdownMenuLabel>Favoritos</DropdownMenuLabel>
              {localFavorites.map((f) => (
                <DropdownMenuItem key={f.id} disabled={!f.snapshot} onClick={() => onOpen(f)}>
                  <Star /> {f.name}
                </DropdownMenuItem>
              ))}
            </>
          )}
          {localFavorites.length > 0 && localTemplates.length > 0 && <DropdownMenuSeparator />}
          {localTemplates.length > 0 && (
            <>
              <DropdownMenuLabel>Templates</DropdownMenuLabel>
              {localTemplates.map((t) => (
                <DropdownMenuItem key={t.id} disabled={!t.snapshot} onClick={() => onOpen(t)}>
                  <Bookmark /> {t.name}
                </DropdownMenuItem>
              ))}
            </>
          )}
        </DropdownMenuContent>
      </DropdownMenu>

      <Dialog open={templateOpen} onOpenChange={(open) => !savingTemplate && setTemplateOpen(open)}>
        <DialogContent size="sm">
          <DialogHeader>
            <DialogTitle>Salvar template SOAP</DialogTitle>
          </DialogHeader>
          <DialogBody className="space-y-4">
            <Field>
              <FieldLabel htmlFor="soap-template-name">Nome</FieldLabel>
              <Input
                id="soap-template-name"
                value={templateName}
                maxLength={120}
                onChange={(e) => setTemplateName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleSaveTemplate()
                }}
              />
            </Field>
            <Field>
              <FieldLabel htmlFor="soap-template-description">Descrição</FieldLabel>
              <Textarea
                id="soap-template-description"
                value={templateDescription}
                maxLength={500}
                onChange={(e) => setTemplateDescription(e.target.value)}
              />
            </Field>
            <p className="text-xs text-muted-foreground">
              Salva o tipo, método, cliente/TBC, dataserver ou processo, contexto e o XML atual da requisição.
            </p>
          </DialogBody>
          <DialogFooter>
            <Button type="button" variant="outline" disabled={savingTemplate} onClick={() => setTemplateOpen(false)}>
              Cancelar
            </Button>
            <Button type="button" disabled={savingTemplate} onClick={handleSaveTemplate}>
              {savingTemplate && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Salvar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
