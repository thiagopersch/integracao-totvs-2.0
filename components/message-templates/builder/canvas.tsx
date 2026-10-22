"use client"

import { useSyncExternalStore } from "react"
import DOMPurify from "dompurify"
import { useDraggable, useDroppable } from "@dnd-kit/core"
import { ArrowDown, ArrowUp, Copy, GripVertical, ImageIcon, Minus, Plus, Trash2 } from "lucide-react"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { cn } from "@/lib/utils"
import { renderLeafBlock } from "@/lib/message-templates/render-email"
import {
  BLOCK_TYPE_LABELS,
  LEAF_BLOCK_TYPES,
  type Block,
  type ContainerBlock,
  type LeafBlock,
  type RowBlock,
} from "@/lib/message-templates/block-types"
import { sameLocation, type BlockLocation } from "@/lib/message-templates/block-tree-utils"
import { RichTextEditor, EMAIL_TYPOGRAPHY_CLASSES } from "../rich-text-editor"
import { PALETTE_ITEMS } from "./block-palette"
import { useBuilder } from "./builder-context"
import { WithTooltip } from "@/components/shared/with-tooltip"

/** Drop indicator: where the dragged block will land (between blocks — absolutely positioned in the
 *  gap so showing it never shifts the layout under the pointer). Vertical in flex-row containers. */
function DropLine({ edge, horizontal }: { edge: "before" | "after"; horizontal?: boolean }) {
  return (
    <div
      aria-hidden
      className={cn(
        "pointer-events-none absolute z-20 rounded-full bg-primary shadow-[0_0_0_2px_rgba(255,255,255,0.9)]",
        "before:absolute before:size-2 before:rounded-full before:bg-primary after:absolute after:size-2 after:rounded-full after:bg-primary",
        horizontal
          ? cn(
              "inset-y-0 w-0.5 before:-top-1 before:-left-[3px] after:-bottom-1 after:-left-[3px]",
              edge === "before" ? "-left-[7px]" : "-right-[7px]"
            )
          : cn(
              "inset-x-0 h-0.5 before:-top-[3px] before:-left-1 after:-top-[3px] after:-right-1",
              edge === "before" ? "-top-[8px]" : "-bottom-[8px]"
            )
      )}
    />
  )
}

/** Dashed outline + name tag + hover actions shared by every block on the canvas. Every block can be
 *  dragged (grip) anywhere valid, and is itself a drop target deciding "before / after" it. */
function BlockFrame({
  block,
  location,
  index,
  siblings,
  horizontal,
  children,
}: {
  block: Block | LeafBlock
  location: BlockLocation
  index: number
  siblings: number
  /** Inside a flex-row container: siblings are side by side, so before/after is left/right. */
  horizontal?: boolean
  children: React.ReactNode
}) {
  const { selectedId, select, moveBlock, duplicateBlock, removeBlock, dropTarget } = useBuilder()
  const selected = selectedId === block.id
  const {
    setNodeRef: setDragNodeRef,
    setActivatorNodeRef,
    attributes,
    listeners,
    isDragging,
  } = useDraggable({ id: `drag:${block.id}`, data: { source: "block", blockId: block.id, blockType: block.type } })
  const { setNodeRef: setDropNodeRef } = useDroppable({ id: `block:${block.id}`, data: { location, index, horizontal } })
  const here = dropTarget && sameLocation(dropTarget.location, location)
  const lineBefore = here && dropTarget.index === index
  const lineAfter = here && index === siblings - 1 && dropTarget.index === siblings

  return (
    <div
      ref={(node) => {
        setDragNodeRef(node)
        setDropNodeRef(node)
      }}
      onClick={(e) => {
        e.stopPropagation()
        select(block.id)
      }}
      className={cn(
        "group/block relative my-3 rounded-md border border-dashed border-neutral-300 p-2 transition-[border-color,opacity] duration-150",
        "hover:border-primary/60",
        selected && "border-solid border-primary ring-2 ring-primary/25",
        isDragging && "opacity-40"
      )}
    >
      {lineBefore && <DropLine edge="before" horizontal={horizontal} />}
      {lineAfter && <DropLine edge="after" horizontal={horizontal} />}
      <div className="absolute -top-2.5 left-2 z-10 flex items-center gap-0.5 rounded border border-neutral-300 bg-white px-1 text-[10px] leading-4 text-neutral-500">
        <span
          ref={setActivatorNodeRef}
          {...attributes}
          {...listeners}
          className="-ml-0.5 cursor-grab touch-none text-neutral-400 hover:text-neutral-700 active:cursor-grabbing"
          title="Arrastar para mover (para dentro ou para fora de contêineres e colunas)"
        >
          <GripVertical className="h-3 w-3" />
        </span>
        {block.name || BLOCK_TYPE_LABELS[block.type]}
      </div>
      <div
        className={cn(
          "absolute -top-3 right-2 z-10 hidden items-center gap-0.5 rounded-md border bg-popover p-0.5 text-popover-foreground shadow-sm group-hover/block:flex",
          selected && "flex"
        )}
        onClick={(e) => e.stopPropagation()}
      >
        <FrameAction title="Mover para cima" disabled={index === 0} onClick={() => moveBlock(block.id, index - 1)}>
          <ArrowUp className="h-3 w-3" />
        </FrameAction>
        <FrameAction title="Mover para baixo" disabled={index >= siblings - 1} onClick={() => moveBlock(block.id, index + 1)}>
          <ArrowDown className="h-3 w-3" />
        </FrameAction>
        <FrameAction title="Duplicar" onClick={() => duplicateBlock(block.id)}>
          <Copy className="h-3 w-3" />
        </FrameAction>
        <FrameAction title="Excluir" danger onClick={() => removeBlock(block.id)}>
          <Trash2 className="h-3 w-3" />
        </FrameAction>
      </div>
      {children}
    </div>
  )
}

function FrameAction({
  title,
  onClick,
  disabled,
  danger,
  children,
}: {
  title: string
  onClick: () => void
  disabled?: boolean
  danger?: boolean
  children: React.ReactNode
}) {
  return (
    <WithTooltip label={title} disabledSafe>
      <button
        type="button"
        aria-label={title}
        disabled={disabled}
        onClick={onClick}
        className={cn(
          "inline-flex h-5 w-5 items-center justify-center rounded hover:bg-accent disabled:pointer-events-none disabled:opacity-30",
          danger && "text-destructive"
        )}
      >
        {children}
      </button>
    </WithTooltip>
  )
}

const noopSubscribe = () => () => {}

/** Leaf content: the same HTML the email gets (so the canvas is WYSIWYG); text is edited inline. */
function LeafView({ block }: { block: LeafBlock }) {
  const { selectedId, updateBlock, variableGroups } = useBuilder()
  // DOMPurify needs a DOM — without one (SSR) `sanitize` doesn't exist, so the HTML is only injected
  // in the browser; the server renders the empty wrapper and hydration fills it in.
  const isBrowser = useSyncExternalStore(noopSubscribe, () => true, () => false)
  if (block.type === "text" && selectedId === block.id) {
    return (
      <RichTextEditor
        key={block.id}
        value={block.props.html}
        variableGroups={variableGroups}
        onChange={(html) => updateBlock(block.id, (b) => ({ ...(b as typeof block), props: { html } }))}
      />
    )
  }
  if (block.type === "image" && !block.props.src) {
    return (
      <div className="flex h-24 flex-col items-center justify-center gap-1 rounded-md bg-neutral-100 text-xs text-neutral-500">
        <ImageIcon className="h-5 w-5" />
        Selecione e envie uma imagem no painel ao lado
      </div>
    )
  }
  const repeatedRows = block.type === "table" ? (block.props.repeatRows ?? []).length : 0
  return (
    <>
      <div
        className={cn("pointer-events-none", block.type === "text" && EMAIL_TYPOGRAPHY_CLASSES)}
        dangerouslySetInnerHTML={{
          // renderLeafBlock already sanitizes server-side-compatibly; DOMPurify is the browser-grade
          // second layer since this is injected into the app's own origin.
          __html: isBrowser
            ? DOMPurify.sanitize(
                `<table role="presentation" width="100%" border="0" cellpadding="0" cellspacing="0"><tr>${renderLeafBlock(block)}</tr></table>`
              )
            : "",
        }}
      />
      {repeatedRows > 0 && (
        <p className="mt-1 text-[10px] text-sky-600">
          ↻ {repeatedRows === 1 ? "1 linha repetida" : `${repeatedRows} linhas repetidas`} para cada cliente
        </p>
      )}
    </>
  )
}

function AddLeafMenu({ location }: { location: BlockLocation }) {
  const { addLeaf } = useBuilder()
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        onClick={(e) => e.stopPropagation()}
        className="mt-1 inline-flex cursor-pointer items-center gap-1 rounded px-1.5 py-0.5 text-xs text-neutral-500 hover:bg-neutral-100 hover:text-neutral-800"
      >
        <Plus className="h-3 w-3" /> Adicionar
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start">
        {PALETTE_ITEMS.filter((i) => (LEAF_BLOCK_TYPES as string[]).includes(i.type)).map((item) => (
          <DropdownMenuItem key={item.type} onClick={() => addLeaf(location, item.type as LeafBlock["type"])}>
            <item.icon className="mr-2 h-4 w-4" /> {BLOCK_TYPE_LABELS[item.type]}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

/** Drop zone of a row column / container. Leaf blocks only (max nesting depth = 2). */
function ChildrenZone({
  id,
  location,
  items,
  className,
  style,
  emptyLabel,
  horizontal,
}: {
  id: string
  location: BlockLocation
  items: LeafBlock[]
  className?: string
  style?: React.CSSProperties
  emptyLabel: string
  horizontal?: boolean
}) {
  const { dropTarget } = useBuilder()
  const { setNodeRef } = useDroppable({ id, data: { location, count: items.length } })
  const isTarget = !!dropTarget && sameLocation(dropTarget.location, location)
  return (
    <div
      ref={setNodeRef}
      className={cn(
        "min-h-14 rounded-md border border-dashed border-neutral-200 p-1.5 transition-colors",
        isTarget && "border-primary bg-primary/5",
        className
      )}
      style={style}
    >
      {items.length === 0 && (
        <p className={cn("py-2 text-center text-[11px] text-neutral-400", isTarget && "text-primary")}>{emptyLabel}</p>
      )}
      {items.map((child, i) => (
        <BlockFrame key={child.id} block={child} location={location} index={i} siblings={items.length} horizontal={horizontal}>
          <LeafView block={child} />
        </BlockFrame>
      ))}
      <AddLeafMenu location={location} />
    </div>
  )
}

function RowView({ block }: { block: RowBlock }) {
  const { addColumn, removeColumn, selectedId } = useBuilder()
  const selected = selectedId === block.id
  return (
    <div
      className="rounded"
      style={{
        padding: `${block.props.paddingY}px ${block.props.paddingX}px`,
        backgroundColor: block.props.backgroundColor,
      }}
    >
      <div className="flex gap-2">
        {block.children.map((column, i) => (
          <div key={column.id} style={{ width: `${column.props.widthPercent}%` }} className="min-w-0">
            <div className="mb-1 flex items-center justify-between text-[10px] text-neutral-400">
              <span>
                Coluna {i + 1} · {column.props.widthPercent}%
              </span>
              {selected && block.children.length > 1 && (
                <WithTooltip label="Remover coluna">
                  <button
                    type="button"
                    aria-label="Remover coluna"
                    onClick={(e) => {
                      e.stopPropagation()
                      removeColumn(block.id, column.id)
                    }}
                    className="rounded p-0.5 hover:bg-neutral-100 hover:text-destructive"
                  >
                    <Minus className="h-3 w-3" />
                  </button>
                </WithTooltip>
              )}
            </div>
            <ChildrenZone
              id={`column:${block.id}:${column.id}`}
              location={{ type: "column", rowId: block.id, columnId: column.id }}
              items={column.children}
              emptyLabel="Solte elementos aqui"
            />
          </div>
        ))}
      </div>
      {selected && block.children.length < 6 && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation()
            addColumn(block.id)
          }}
          className="mt-1 inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-xs text-neutral-500 hover:bg-neutral-100"
        >
          <Plus className="h-3 w-3" /> Coluna
        </button>
      )}
    </div>
  )
}

const FLEX_JUSTIFY: Record<string, string> = {
  "flex-start": "flex-start",
  "flex-end": "flex-end",
  center: "center",
  "space-between": "space-between",
}

function ContainerView({ block }: { block: ContainerBlock }) {
  const p = block.props
  const flex = p.display === "flex"
  return (
    <div style={{ padding: `${p.marginY}px ${p.marginX}px` }}>
      <ChildrenZone
        id={`container:${block.id}`}
        location={{ type: "container", containerId: block.id }}
        items={block.children}
        emptyLabel="Solte elementos dentro do contêiner"
        horizontal={flex && (p.flexDirection ?? "row").startsWith("row")}
        className={cn(flex && "flex flex-wrap [&>*]:my-1")}
        style={{
          padding: `${p.paddingY}px ${p.paddingX}px`,
          backgroundColor: p.backgroundColor,
          borderRadius: p.borderRadius ?? 0,
          ...(p.borderColor && p.borderColor !== "transparent" ? { border: `1px solid ${p.borderColor}` } : {}),
          ...(flex
            ? {
                flexDirection: p.flexDirection ?? "row",
                justifyContent: FLEX_JUSTIFY[p.justifyContent ?? "flex-start"],
                alignItems: p.alignItems ?? "stretch",
                gap: p.gap ?? 0,
              }
            : {}),
        }}
      />
    </div>
  )
}

const TOP: BlockLocation = { type: "top" }

function TopLevelBlock({ block, index, siblings }: { block: Block; index: number; siblings: number }) {
  return (
    <BlockFrame block={block} location={TOP} index={index} siblings={siblings}>
      {block.type === "row" ? (
        <RowView block={block} />
      ) : block.type === "container" ? (
        <ContainerView block={block} />
      ) : (
        <LeafView block={block} />
      )}
      {block.type === "container" && block.props.repeatPerClient && (
        <p className="mt-1 text-[10px] text-sky-600">↻ Repetido para cada cliente</p>
      )}
      {block.props && "visibleIf" in block.props && block.props.visibleIf && (
        <p className="mt-1 text-[10px] text-amber-600">Visível só quando {`{{${block.props.visibleIf}}}`} estiver preenchido</p>
      )}
    </BlockFrame>
  )
}

/** The email canvas: a white 600px "paper" (like the real email) holding the draggable blocks. */
export function Canvas() {
  const { tree, select, dropTarget } = useBuilder()
  const { setNodeRef } = useDroppable({ id: "canvas" })

  return (
    <div
      ref={setNodeRef}
      onClick={() => select(null)}
      className={cn(
        "min-h-[520px] rounded-lg border border-dashed bg-muted/30 p-4 transition-colors md:p-8",
        dropTarget?.location.type === "top" && "border-primary bg-primary/5"
      )}
    >
      <div className="mx-auto max-w-[600px] rounded-md bg-white px-4 py-3 text-neutral-900 shadow-sm [font-family:Arial,Helvetica,sans-serif]">
        {tree.length === 0 ? (
          <p className="py-24 text-center text-sm text-neutral-500">
            Arraste elementos da paleta à esquerda para começar a montar o template.
          </p>
        ) : (
          tree.map((block, i) => <TopLevelBlock key={block.id} block={block} index={i} siblings={tree.length} />)
        )}
      </div>
    </div>
  )
}
