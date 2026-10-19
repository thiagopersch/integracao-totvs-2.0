"use client"

import { createContext, useContext } from "react"
import type { Block, BlockTree, LeafBlock, LeafBlockType } from "@/lib/message-templates/block-types"
import type { BlockLocation } from "@/lib/message-templates/block-tree-utils"
import type { VariableGroup } from "@/lib/message-templates/variable-catalog"
import type { MessageTemplateScope } from "@/lib/message-templates/events"

export interface BuilderApi {
  tree: BlockTree
  selectedId: string | null
  select: (id: string | null) => void
  updateBlock: (id: string, updater: (block: Block | LeafBlock) => Block | LeafBlock) => void
  removeBlock: (id: string) => void
  moveBlock: (id: string, toIndex: number) => void
  duplicateBlock: (id: string) => void
  addLeaf: (location: BlockLocation, type: LeafBlockType) => void
  addColumn: (rowId: string) => void
  removeColumn: (rowId: string, columnId: string) => void
  resizeColumn: (rowId: string, columnId: string, widthPercent: number) => void
  variableGroups: VariableGroup[]
  /** ALL_CLIENTS enables the "Repetir para cada cliente" container option. */
  scope: MessageTemplateScope
}

export const BuilderContext = createContext<BuilderApi | null>(null)

export function useBuilder(): BuilderApi {
  const ctx = useContext(BuilderContext)
  if (!ctx) throw new Error("useBuilder must be used inside <BuilderContext.Provider>")
  return ctx
}
