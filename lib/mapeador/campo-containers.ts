import type { MapeadorCampo } from "@/types/mapeador"

/**
 * A passo's campos form a two-level container tree: the passo's own top-level list ("root"), and
 * one container per coluna inside each tipo "agrupamento" campo at that root (colunas can't nest
 * another agrupamento, so no deeper recursion is needed). Used to let drag-and-drop move a campo
 * between any of these containers within a single shared DndContext.
 */
export const ROOT_CONTAINER = "root"

export function colunaContainerId(colunaId: string): string {
  return `coluna:${colunaId}`
}

export function isContainerId(id: string, campos: MapeadorCampo[]): boolean {
  return allContainerIds(campos).includes(id)
}

export function allContainerIds(campos: MapeadorCampo[]): string[] {
  const ids = [ROOT_CONTAINER]
  for (const c of campos) {
    if (c.tipo === "agrupamento") {
      for (const col of c.colunas ?? []) ids.push(colunaContainerId(col.id))
    }
  }
  return ids
}

export function getContainer(campos: MapeadorCampo[], containerId: string): MapeadorCampo[] {
  if (containerId === ROOT_CONTAINER) return campos
  for (const c of campos) {
    if (c.tipo === "agrupamento") {
      const col = (c.colunas ?? []).find((col) => colunaContainerId(col.id) === containerId)
      if (col) return col.campos
    }
  }
  return []
}

export function setContainer(campos: MapeadorCampo[], containerId: string, items: MapeadorCampo[]): MapeadorCampo[] {
  if (containerId === ROOT_CONTAINER) return items
  return campos.map((c) => {
    if (c.tipo !== "agrupamento") return c
    const colunas = (c.colunas ?? []).map((col) => (colunaContainerId(col.id) === containerId ? { ...col, campos: items } : col))
    return { ...c, colunas }
  })
}

export function findContainerOf(campos: MapeadorCampo[], campoId: string): string | null {
  if (campos.some((c) => c.id === campoId)) return ROOT_CONTAINER
  for (const c of campos) {
    if (c.tipo === "agrupamento") {
      for (const col of c.colunas ?? []) {
        if (col.campos.some((cf) => cf.id === campoId)) return colunaContainerId(col.id)
      }
    }
  }
  return null
}
