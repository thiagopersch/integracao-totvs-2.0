"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { useRouter } from "next/navigation"
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  pointerWithin,
  useSensor,
  useSensors,
  type Active,
  type CollisionDetection,
  type DragEndEvent,
  type DragMoveEvent,
  type DragStartEvent,
  type Over,
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
import { isLeafType, type BlockTree } from "@/lib/message-templates/block-types"
import {
  MESSAGE_CHANNEL_LABELS,
  MESSAGE_CHANNELS,
  MESSAGE_EVENT_DESCRIPTIONS,
  MESSAGE_EVENT_GROUPS,
  MESSAGE_EVENT_LABELS,
  MESSAGE_SCOPE_DESCRIPTIONS,
  MESSAGE_SCOPE_LABELS,
  supportsAllClients,
  type MessageChannel,
  type MessageTemplateEvent,
  type MessageTemplateScope,
} from "@/lib/message-templates/events"
import { variableGroupsForEvent } from "@/lib/message-templates/variable-catalog"
import {
  allowedAttachmentTypes,
  defaultAttachmentFileName,
  type TemplateAttachment,
} from "@/lib/message-templates/attachments"
import { VariableInput } from "../variable-input"
import { BlockPalette, BlockTypeCard, type PaletteBlockType } from "./block-palette"
import { BuilderContext, type BuilderApi, type DropTarget } from "./builder-context"
import { Canvas } from "./canvas"
import { InspectorPanel } from "./inspector-panel"
import { PreviewDialog } from "./preview-dialog"
import { WhatsAppEditor } from "./whatsapp-editor"
import { AttachmentsEditor } from "./attachments-editor"
import { WithTooltip } from "@/components/shared/with-tooltip"

export interface TemplateBuilderValue {
  name: string
  channel: MessageChannel
  event: MessageTemplateEvent
  scope: MessageTemplateScope
  subject: string
  content: BlockTree
  attachments: TemplateAttachment[]
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
    scope: "PER_CLIENT",
    subject: d.subject,
    content: d.content,
    attachments: [],
    bodyText: d.whatsapp,
    isActive: true,
  }
}

const SCOPES: MessageTemplateScope[] = ["PER_CLIENT", "ALL_CLIENTS"]

/** Spreadsheets the built-in default of an event/scope starts with. */
function defaultAttachments(event: MessageTemplateEvent, scope: MessageTemplateScope): TemplateAttachment[] {
  return allowedAttachmentTypes(event, scope).map((type) => ({ type, fileName: defaultAttachmentFileName(type, scope) }))
}

const isNestedZone = (id: unknown) => typeof id === "string" && (id.startsWith("column:") || id.startsWith("container:"))

/** What's being dragged: a palette item (new block) or an existing block of the canvas. */
type ActiveDrag = { kind: "palette"; type: PaletteBlockType } | { kind: "block"; id: string; type: PaletteBlockType; name?: string }

const dragInfo = (active: Active) => {
  const data = active.data.current
  const type = data?.blockType as PaletteBlockType | undefined
  return { blockId: data?.source === "block" ? (data.blockId as string) : null, leaf: !!type && isLeafType(type), type }
}

/** Drop-target rank — the innermost wins: nested block > nested zone > top-level block > canvas. */
function targetRank(id: string, location?: treeUtils.BlockLocation): number {
  if (id.startsWith("block:")) return location && location.type !== "top" ? 0 : 2
  if (isNestedZone(id)) return 1
  return 3
}

/** Pointer position of a drag (the activator event's position + how far it moved). */
function pointerOf(event: { activatorEvent: Event; delta: { x: number; y: number } }) {
  const start = event.activatorEvent as PointerEvent
  return { x: (start.clientX ?? 0) + event.delta.x, y: (start.clientY ?? 0) + event.delta.y }
}

export function TemplateBuilder({ template, canSave }: TemplateBuilderProps) {
  const router = useRouter()
  // One initial value for both (the built-in default gets fresh random block ids on every call).
  const [initial] = useState(() => initialValue(template))
  const [value, setValue] = useState<TemplateBuilderValue>(initial)
  const [savedSnapshot, setSavedSnapshot] = useState(() => JSON.stringify(initial))
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [activeDrag, setActiveDrag] = useState<ActiveDrag | null>(null)
  const [dropTarget, setDropTarget] = useState<DropTarget | null>(null)
  const [previewOpen, setPreviewOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const [testing, setTesting] = useState(false)
  const [leaveOpen, setLeaveOpen] = useState(false)
  const [errors, setErrors] = useState<Record<string, string>>({})

  const dirty = JSON.stringify(value) !== savedSnapshot
  const variableGroups = useMemo(() => variableGroupsForEvent(value.event, value.scope), [value.event, value.scope])
  const canChooseScope = value.channel === "EMAIL" && supportsAllClients(value.event)

  useEffect(() => {
    if (!dirty) return
    const handler = (e: BeforeUnloadEvent) => e.preventDefault()
    window.addEventListener("beforeunload", handler)
    return () => window.removeEventListener("beforeunload", handler)
  }, [dirty])

  const patch = useCallback((p: Partial<TemplateBuilderValue>) => setValue((v) => ({ ...v, ...p })), [])
  const setTree = useCallback((fn: (tree: BlockTree) => BlockTree) => setValue((v) => ({ ...v, content: fn(v.content) })), [])

  /**
   * On a brand-new template still showing a built-in default, switching event or scope loads that
   * event/scope's default. Events without "Todos os clientes" fall back to "Por cliente".
   */
  function changeKind(event: MessageTemplateEvent, requestedScope: MessageTemplateScope) {
    const scope = value.channel === "EMAIL" && supportsAllClients(event) ? requestedScope : "PER_CLIENT"
    const current = defaultTemplate(value.event, value.scope)
    const untouched =
      !template &&
      value.subject === current.subject &&
      value.bodyText === current.whatsapp &&
      JSON.stringify(value.content.map((b) => b.type)) === JSON.stringify(current.content.map((b) => b.type))
    if (untouched) {
      const next = defaultTemplate(event, scope)
      setValue((v) => ({
        ...v,
        event,
        scope,
        subject: next.subject,
        content: next.content,
        // The all-clients defaults are email-only — keep the WhatsApp text of the per-client one.
        bodyText: next.whatsapp || v.bodyText,
        attachments: defaultAttachments(event, scope),
      }))
      setSelectedId(null)
    } else {
      // Drop attachments the new event/scope can't generate.
      const allowed = allowedAttachmentTypes(event, scope)
      setValue((v) => ({ ...v, event, scope, attachments: v.attachments.filter((a) => allowed.includes(a.type)) }))
    }
  }

  const api: BuilderApi = useMemo(
    () => ({
      tree: value.content,
      selectedId,
      select: setSelectedId,
      variableGroups,
      scope: value.scope,
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
      dropTarget,
    }),
    [value.content, selectedId, variableGroups, value.scope, setTree, dropTarget]
  )

  function addFromPalette(type: PaletteBlockType) {
    const block = treeUtils.createDefaultBlock(type, value.content)
    setTree((t) => treeUtils.insertBlock(t, block, { type: "top" }))
    setSelectedId(block.id)
  }

  // ---- drag & drop -------------------------------------------------------------------------
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 4 } }))

  /**
   * The innermost valid target under the pointer. Rows/containers (palette or existing) only go at the
   * top level, so nested targets are ignored for them; a container being moved ignores its own zone
   * and children (it can't be dropped into itself).
   */
  const collisionDetection: CollisionDetection = useCallback((args) => {
    const { blockId, leaf } = dragInfo(args.active)
    const droppableContainers = args.droppableContainers.filter((c) => {
      const id = String(c.id)
      const location = c.data.current?.location as treeUtils.BlockLocation | undefined
      const nested = isNestedZone(id) || (id.startsWith("block:") && location?.type !== "top")
      if (nested && !leaf) return false
      if (blockId && (id === `container:${blockId}` || (location?.type === "container" && location.containerId === blockId))) return false
      return true
    })
    const within = pointerWithin({ ...args, droppableContainers })
    const rank = (c: (typeof within)[number]) =>
      targetRank(String(c.id), args.droppableContainers.find((d) => d.id === c.id)?.data.current?.location)
    const best = within.sort((a, b) => rank(a) - rank(b))[0]
    return best ? [best] : []
  }, [])

  /** Insertion point for `over` at the pointer — null when nothing valid or the drop wouldn't change anything. */
  function resolveDropTarget(active: Active, over: Over | null, pointer: { x: number; y: number }): DropTarget | null {
    if (!over) return null
    const id = String(over.id)
    const data = over.data.current
    let target: DropTarget
    if (id.startsWith("block:")) {
      const { rect } = over
      const after = data?.horizontal ? pointer.x > rect.left + rect.width / 2 : pointer.y > rect.top + rect.height / 2
      target = { location: data?.location, index: (data?.index as number) + (after ? 1 : 0) }
    } else if (isNestedZone(id)) {
      target = { location: data?.location, index: data?.count ?? 0 }
    } else {
      target = { location: { type: "top" }, index: value.content.length }
    }
    const { blockId } = dragInfo(active)
    if (blockId) {
      // Right before or after itself: the block wouldn't move — no indicator.
      const found = treeUtils.findBlock(value.content, blockId)
      if (found && treeUtils.sameLocation(found.location, target.location) && (target.index === found.index || target.index === found.index + 1)) {
        return null
      }
    }
    return target
  }

  function onDragStart(event: DragStartEvent) {
    const { blockId, type } = dragInfo(event.active)
    if (!type) return
    const name = blockId ? treeUtils.findBlock(value.content, blockId)?.block.name : undefined
    setActiveDrag(blockId ? { kind: "block", id: blockId, type, name } : { kind: "palette", type })
  }

  function onDragMove(event: DragMoveEvent) {
    const next = resolveDropTarget(event.active, event.over, pointerOf(event))
    // Only re-render the canvas when the landing spot actually changes, not on every pixel.
    setDropTarget((current) => (JSON.stringify(current) === JSON.stringify(next) ? current : next))
  }

  function endDrag() {
    setActiveDrag(null)
    setDropTarget(null)
  }

  function onDragEnd(event: DragEndEvent) {
    endDrag()
    const target = resolveDropTarget(event.active, event.over, pointerOf(event))
    if (!target) return
    const { blockId, leaf, type } = dragInfo(event.active)
    if (target.location.type !== "top" && !leaf) return

    if (blockId) {
      setTree((t) => treeUtils.moveBlockToLocation(t, blockId, target.location, target.index))
      setSelectedId(blockId)
      return
    }
    if (!type) return
    const block = treeUtils.createDefaultBlock(type, value.content)
    setTree((t) => treeUtils.insertBlock(t, block, target.location, target.index))
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
    <div className="space-y-4 p-4 md:p-6">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-2 border-b pb-4">
        <WithTooltip label="Voltar">
          <Button type="button" variant="ghost" size="icon-sm" aria-label="Voltar" onClick={handleCancel}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </WithTooltip>
        <Input
          value={value.name}
          onChange={(e) => patch({ name: e.target.value })}
          placeholder="Nome do template"
          className="w-full sm:w-64"
          maxLength={120}
          aria-invalid={!!errors.name}
        />
        <Select
          items={MESSAGE_CHANNELS.map((c) => ({ value: c, label: MESSAGE_CHANNEL_LABELS[c] }))}
          value={value.channel}
          onValueChange={(v) => {
            if (!v) return
            const channel = v as MessageChannel
            // "Todos os clientes" is email-only.
            setValue((cur) => ({ ...cur, channel, scope: channel === "EMAIL" ? cur.scope : "PER_CLIENT" }))
          }}
        >
          <SelectTrigger className="w-full sm:w-36">
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
          onValueChange={(v) => v && changeKind(v as MessageTemplateEvent, value.scope)}
        >
          <SelectTrigger className="w-full sm:w-64" title={MESSAGE_EVENT_DESCRIPTIONS[value.event]}>
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
        {canChooseScope && (
          <Select
            items={SCOPES.map((s) => ({ value: s, label: MESSAGE_SCOPE_LABELS[s] }))}
            value={value.scope}
            onValueChange={(v) => v && changeKind(value.event, v as MessageTemplateScope)}
          >
            <SelectTrigger className="w-full sm:w-44" title={MESSAGE_SCOPE_DESCRIPTIONS[value.scope]} aria-label="Escopo">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {SCOPES.map((s) => (
                <SelectItem key={s} value={s}>
                  {MESSAGE_SCOPE_LABELS[s]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
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
            <WithTooltip label="Envia para o seu e-mail com dados de exemplo" disabledSafe>
              <Button type="button" variant="outline" onClick={handleTest} disabled={testing}>
                {testing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Send className="mr-2 h-4 w-4" />}
                Enviar teste
              </Button>
            </WithTooltip>
          )}
          {canSave && (
            <Button type="button" onClick={handleSave} disabled={saving}>
              {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
              Salvar
            </Button>
          )}
        </div>
      </div>
      <p className="-mt-2 text-xs text-muted-foreground">
        {value.scope === "ALL_CLIENTS"
          ? `${MESSAGE_SCOPE_DESCRIPTIONS.ALL_CLIENTS} Enviado pelas regras de Integrações > Envio de relatórios${
              value.event === "CONTRACT_USAGE" ? " (não substitui o aviso automático de consumo por cliente)" : ""
            }.`
          : MESSAGE_EVENT_DESCRIPTIONS[value.event]}
      </p>

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
          <AttachmentsEditor
            value={value.attachments}
            onChange={(attachments) => patch({ attachments })}
            variableGroups={variableGroups}
            allowedTypes={allowedAttachmentTypes(value.event, value.scope)}
            scope={value.scope}
            error={errors.attachments}
          />
          <DndContext
            // Fixed id: dnd-kit's auto ids come from a global counter that differs between SSR and the
            // browser, which breaks hydration of the aria-describedby attributes.
            id="message-template-builder"
            sensors={sensors}
            collisionDetection={collisionDetection}
            onDragStart={onDragStart}
            onDragMove={onDragMove}
            onDragEnd={onDragEnd}
            onDragCancel={endDrag}
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
            <DragOverlay dropAnimation={{ duration: 150, easing: "ease-out" }}>
              {activeDrag ? (
                <div className="w-max max-w-64">
                  <BlockTypeCard type={activeDrag.type} name={activeDrag.kind === "block" ? activeDrag.name : undefined} dragging />
                </div>
              ) : null}
            </DragOverlay>
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
        scope={value.scope}
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
