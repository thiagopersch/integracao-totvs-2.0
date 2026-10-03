"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { useRouter } from "next/navigation"
import {
  closestCenter,
  DndContext,
  DragOverlay,
  PointerSensor,
  pointerWithin,
  useSensor,
  useSensors,
  type CollisionDetection,
  type DragEndEvent,
  type DragStartEvent,
} from "@dnd-kit/core"
import { ArrowLeft, Eye, Loader2, Save, Send } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { ConfirmDialog } from "@/components/shared/confirm-dialog"
import { createMessageTemplate, sendTestMessageTemplate, updateMessageTemplate } from "@/actions/message-templates"
import { messageTemplateSchema } from "@/schemas/message-template.schema"
import * as treeUtils from "@/lib/message-templates/block-tree-utils"
import { defaultTemplate } from "@/lib/message-templates/defaults"
import { isLeafType, type BlockTree, type LeafBlock } from "@/lib/message-templates/block-types"
import {
  MESSAGE_CHANNEL_LABELS,
  MESSAGE_CHANNELS,
  MESSAGE_EVENT_DESCRIPTIONS,
  MESSAGE_EVENT_GROUPS,
  MESSAGE_EVENT_LABELS,
  type MessageChannel,
  type MessageTemplateEvent,
} from "@/lib/message-templates/events"
import { variableGroupsForEvent } from "@/lib/message-templates/variable-catalog"
import { VariableInput } from "../variable-input"
import { BlockPalette, BlockTypeCard, type PaletteBlockType } from "./block-palette"
import { BuilderContext, type BuilderApi } from "./builder-context"
import { Canvas } from "./canvas"
import { InspectorPanel } from "./inspector-panel"
import { PreviewDialog } from "./preview-dialog"
import { WhatsAppEditor } from "./whatsapp-editor"

export interface TemplateBuilderValue {
  name: string
  channel: MessageChannel
  event: MessageTemplateEvent
  subject: string
  content: BlockTree
  bodyText: string
  isActive: boolean
}

interface TemplateBuilderProps {
  /** Existing template (edit) — null for a new one. */
  template: (TemplateBuilderValue & { id: string }) | null
  canSave: boolean
}

const LIST_HREF = "/integrations/message-templates"

function initialValue(template: TemplateBuilderProps["template"]): TemplateBuilderValue {
  if (template) return template
  const d = defaultTemplate("CONTRACT_USAGE")
  return {
    name: "",
    channel: "EMAIL",
    event: "CONTRACT_USAGE",
    subject: d.subject,
    content: d.content,
    bodyText: d.whatsapp,
    isActive: true,
  }
}

const isNestedZone = (id: unknown) => typeof id === "string" && (id.startsWith("column:") || id.startsWith("container:"))

export function TemplateBuilder({ template, canSave }: TemplateBuilderProps) {
  const router = useRouter()
  // One initial value for both (the built-in default gets fresh random block ids on every call).
  const [initial] = useState(() => initialValue(template))
  const [value, setValue] = useState<TemplateBuilderValue>(initial)
  const [savedSnapshot, setSavedSnapshot] = useState(() => JSON.stringify(initial))
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [activeDrag, setActiveDrag] = useState<PaletteBlockType | null>(null)
  const [previewOpen, setPreviewOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const [testing, setTesting] = useState(false)
  const [leaveOpen, setLeaveOpen] = useState(false)
  const [errors, setErrors] = useState<Record<string, string>>({})

  const dirty = JSON.stringify(value) !== savedSnapshot
  const variableGroups = useMemo(() => variableGroupsForEvent(value.event), [value.event])

  useEffect(() => {
    if (!dirty) return
    const handler = (e: BeforeUnloadEvent) => e.preventDefault()
    window.addEventListener("beforeunload", handler)
    return () => window.removeEventListener("beforeunload", handler)
  }, [dirty])

  const patch = useCallback((p: Partial<TemplateBuilderValue>) => setValue((v) => ({ ...v, ...p })), [])
  const setTree = useCallback((fn: (tree: BlockTree) => BlockTree) => setValue((v) => ({ ...v, content: fn(v.content) })), [])

  /** On a brand-new template still showing a built-in default, switching event loads that event's default. */
  function changeEvent(event: MessageTemplateEvent) {
    const current = defaultTemplate(value.event)
    const untouched =
      !template &&
      value.subject === current.subject &&
      value.bodyText === current.whatsapp &&
      JSON.stringify(value.content.map((b) => b.type)) === JSON.stringify(current.content.map((b) => b.type))
    if (untouched) {
      const next = defaultTemplate(event)
      setValue((v) => ({ ...v, event, subject: next.subject, content: next.content, bodyText: next.whatsapp }))
      setSelectedId(null)
    } else {
      patch({ event })
    }
  }

  const api: BuilderApi = useMemo(
    () => ({
      tree: value.content,
      selectedId,
      select: setSelectedId,
      variableGroups,
      updateBlock: (id, updater) => setTree((t) => treeUtils.updateBlock(t, id, updater)),
      removeBlock: (id) => {
        setTree((t) => treeUtils.removeBlock(t, id))
        setSelectedId((s) => (s === id ? null : s))
      },
      moveBlock: (id, toIndex) => setTree((t) => treeUtils.moveBlockTo(t, id, toIndex)),
      duplicateBlock: (id) => setTree((t) => treeUtils.duplicateBlock(t, id)),
      addLeaf: (location, type) => {
        const block = treeUtils.createDefaultBlock(type, value.content)
        setTree((t) => treeUtils.insertBlock(t, block, location))
        setSelectedId(block.id)
      },
      addColumn: (rowId) => setTree((t) => treeUtils.addColumnToRow(t, rowId)),
      removeColumn: (rowId, columnId) => setTree((t) => treeUtils.removeColumnFromRow(t, rowId, columnId)),
      resizeColumn: (rowId, columnId, w) => setTree((t) => treeUtils.resizeColumn(t, rowId, columnId, w)),
    }),
    [value.content, selectedId, variableGroups, setTree]
  )

  function addFromPalette(type: PaletteBlockType) {
    const block = treeUtils.createDefaultBlock(type, value.content)
    setTree((t) => treeUtils.insertBlock(t, block, { type: "top" }))
    setSelectedId(block.id)
  }

  // ---- drag & drop -------------------------------------------------------------------------
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 4 } }))

  /** Palette leaves prefer the innermost column/container zone under the pointer; rows/containers
   *  and top-level reordering only consider top-level targets. */
  const collisionDetection: CollisionDetection = useCallback((args) => {
    const data = args.active.data.current
    if (data?.source === "palette") {
      const within = pointerWithin(args)
      if (isLeafType(data.blockType)) {
        const nested = within.find((c) => isNestedZone(c.id))
        if (nested) return [nested]
      }
      const topLevel = within.filter((c) => !isNestedZone(c.id))
      const block = topLevel.find((c) => c.id !== "canvas")
      if (block) return [block]
      if (topLevel.length) return topLevel
      return []
    }
    return closestCenter({
      ...args,
      droppableContainers: args.droppableContainers.filter((c) => c.id !== "canvas" && !isNestedZone(c.id)),
    })
  }, [])

  function onDragStart(event: DragStartEvent) {
    const data = event.active.data.current
    setActiveDrag(data?.source === "palette" ? (data.blockType as PaletteBlockType) : null)
  }

  function onDragEnd(event: DragEndEvent) {
    setActiveDrag(null)
    const { active, over } = event
    if (!over) return
    const data = active.data.current

    if (data?.source === "block") {
      if (active.id === over.id) return
      const toIndex = value.content.findIndex((b) => b.id === over.id)
      if (toIndex >= 0) api.moveBlock(String(active.id), toIndex)
      return
    }
    if (data?.source !== "palette") return

    const type = data.blockType as PaletteBlockType
    const overId = String(over.id)
    if (isNestedZone(overId)) {
      if (!isLeafType(type)) return
      const location = over.data.current?.location as treeUtils.BlockLocation | undefined
      if (location) api.addLeaf(location, type as LeafBlock["type"])
      return
    }

    const block = treeUtils.createDefaultBlock(type, value.content)
    let index: number | undefined
    const overIndex = value.content.findIndex((b) => b.id === overId)
    if (overIndex >= 0) {
      // Before or after the hovered block, depending on which half the dragged card is over.
      const dragged = active.rect.current.translated
      const middle = over.rect.top + over.rect.height / 2
      index = dragged && dragged.top + dragged.height / 2 > middle ? overIndex + 1 : overIndex
    }
    setTree((t) => treeUtils.insertBlock(t, block, { type: "top" }, index))
    setSelectedId(block.id)
  }

  // ---- save / test -------------------------------------------------------------------------
  async function handleSave() {
    const parsed = messageTemplateSchema.safeParse(value)
    if (!parsed.success) {
      const next: Record<string, string> = {}
      for (const issue of parsed.error.issues) next[String(issue.path[0])] ??= issue.message
      setErrors(next)
      toast.error(parsed.error.issues[0]?.message ?? "Verifique os campos do template")
      return
    }
    setErrors({})
    setSaving(true)
    const result = template ? await updateMessageTemplate(template.id, value) : await createMessageTemplate(value)
    setSaving(false)
    if (!result.success) {
      toast.error(result.error || "Erro ao salvar o template")
      return
    }
    setSavedSnapshot(JSON.stringify(value))
    toast.success(template ? "Template atualizado" : "Template criado")
    if (!template && result.id) router.replace(`${LIST_HREF}/${result.id}`)
    else router.refresh()
  }

  async function handleTest() {
    if (!template) return
    if (dirty) {
      toast.warning("Salve as alterações antes de enviar o teste.")
      return
    }
    setTesting(true)
    const result = await sendTestMessageTemplate(template.id)
    setTesting(false)
    if (result.success) toast.success(result.message)
    else toast.error(result.error)
  }

  function handleCancel() {
    if (dirty) setLeaveOpen(true)
    else router.push(LIST_HREF)
  }

  const isEmail = value.channel === "EMAIL"

  return (
    <div className="space-y-4 p-6">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-2 border-b pb-4">
        <Button type="button" variant="ghost" size="icon-sm" title="Voltar" onClick={handleCancel}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <Input
          value={value.name}
          onChange={(e) => patch({ name: e.target.value })}
          placeholder="Nome do template"
          className="w-64"
          maxLength={120}
          aria-invalid={!!errors.name}
        />
        <Select
          items={MESSAGE_CHANNELS.map((c) => ({ value: c, label: MESSAGE_CHANNEL_LABELS[c] }))}
          value={value.channel}
          onValueChange={(v) => v && patch({ channel: v as MessageChannel })}
        >
          <SelectTrigger className="w-36">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {MESSAGE_CHANNELS.map((c) => (
              <SelectItem key={c} value={c}>
                {MESSAGE_CHANNEL_LABELS[c]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select
          items={Object.entries(MESSAGE_EVENT_LABELS).map(([v, label]) => ({ value: v, label }))}
          value={value.event}
          onValueChange={(v) => v && changeEvent(v as MessageTemplateEvent)}
        >
          <SelectTrigger className="w-64" title={MESSAGE_EVENT_DESCRIPTIONS[value.event]}>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {MESSAGE_EVENT_GROUPS.map((group) => (
              <SelectGroup key={group.label}>
                <SelectLabel>{group.label}</SelectLabel>
                {group.events.map((e) => (
                  <SelectItem key={e} value={e}>
                    {MESSAGE_EVENT_LABELS[e]}
                  </SelectItem>
                ))}
              </SelectGroup>
            ))}
          </SelectContent>
        </Select>
        <div className="flex items-center gap-2 px-2">
          <Switch id="tpl-active" checked={value.isActive} onCheckedChange={(isActive) => patch({ isActive })} />
          <Label htmlFor="tpl-active" className="text-sm">
            Ativo
          </Label>
        </div>
        <div className="ml-auto flex items-center gap-2">
          {dirty && <span className="text-xs text-muted-foreground">Alterações não salvas</span>}
          <Button type="button" variant="ghost" onClick={handleCancel}>
            Cancelar
          </Button>
          <Button type="button" variant="outline" onClick={() => setPreviewOpen(true)}>
            <Eye className="mr-2 h-4 w-4" /> Preview
          </Button>
          {template && isEmail && (
            <Button type="button" variant="outline" onClick={handleTest} disabled={testing} title="Envia para o seu e-mail com dados de exemplo">
              {testing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Send className="mr-2 h-4 w-4" />}
              Enviar teste
            </Button>
          )}
          {canSave && (
            <Button type="button" onClick={handleSave} disabled={saving}>
              {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
              Salvar
            </Button>
          )}
        </div>
      </div>
      <p className="-mt-2 text-xs text-muted-foreground">{MESSAGE_EVENT_DESCRIPTIONS[value.event]}</p>

      {isEmail ? (
        <BuilderContext.Provider value={api}>
          <div className="space-y-1.5">
            <Label htmlFor="tpl-subject">Assunto do e-mail</Label>
            <VariableInput
              id="tpl-subject"
              value={value.subject}
              onChange={(subject) => patch({ subject })}
              groups={variableGroups}
              placeholder="Assunto do e-mail"
              className="max-w-3xl"
              aria-invalid={!!errors.subject}
            />
            {errors.subject && <p className="text-xs text-destructive">{errors.subject}</p>}
          </div>
          <DndContext
            sensors={sensors}
            collisionDetection={collisionDetection}
            onDragStart={onDragStart}
            onDragEnd={onDragEnd}
            onDragCancel={() => setActiveDrag(null)}
          >
            {/* xl: elements | properties | canvas — the properties column only exists while a block is
                selected, so the canvas takes the space back otherwise. Below xl the elements become a bar on top. */}
            <div
              className={cn(
                "grid gap-4",
                selectedId
                  ? "md:grid-cols-[300px_minmax(0,1fr)] xl:grid-cols-[190px_320px_minmax(0,1fr)]"
                  : "xl:grid-cols-[190px_minmax(0,1fr)]"
              )}
            >
              <aside className={cn("xl:sticky xl:top-4 xl:col-span-1 xl:self-start", selectedId && "md:col-span-2")}>
                <BlockPalette onAdd={addFromPalette} />
              </aside>
              {selectedId && (
                <aside className="rounded-lg border bg-card p-4 md:sticky md:top-4 md:max-h-[calc(100vh-6rem)] md:self-start md:overflow-y-auto">
                  <InspectorPanel />
                </aside>
              )}
              <div className="min-w-0">
                <Canvas />
                {errors.content && <p className="mt-1 text-xs text-destructive">{errors.content}</p>}
              </div>
            </div>
            <DragOverlay dropAnimation={null}>{activeDrag ? <BlockTypeCard type={activeDrag} dragging /> : null}</DragOverlay>
          </DndContext>
        </BuilderContext.Provider>
      ) : (
        <WhatsAppEditor
          value={value.bodyText}
          onChange={(bodyText) => patch({ bodyText })}
          variableGroups={variableGroups}
          invalid={!!errors.bodyText}
        />
      )}

      <PreviewDialog
        open={previewOpen}
        onOpenChange={setPreviewOpen}
        channel={value.channel}
        subject={value.subject}
        content={value.content}
        bodyText={value.bodyText}
      />
      <ConfirmDialog
        open={leaveOpen}
        onOpenChange={setLeaveOpen}
        title="Descartar alterações?"
        description="Há alterações não salvas neste template. Deseja sair mesmo assim?"
        confirmLabel="Descartar e sair"
        variant="destructive"
        onConfirm={() => router.push(LIST_HREF)}
      />
    </div>
  )
}
