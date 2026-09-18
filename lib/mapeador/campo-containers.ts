import type { MapeadorCampo } from "@/types/mapeador"

/**
 * A passo's campos form a tree: the passo's own top-level list ("root"), and one container per
 * coluna inside each tipo "agrupamento" campo — at any depth, since an agrupamento can itself sit
 * inside another agrupamento's coluna. Used to let drag-and-drop move a campo between any of these
 * containers within a single shared DndContext. Coluna ids are globally unique
 * (`crypto.randomUUID()`), so a container can always be found by id alone, with no path needed.
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
  function walk(list: MapeadorCampo[]) {
    for (const c of list) {
      if (c.tipo !== "agrupamento") continue
      for (const col of c.colunas ?? []) {
        ids.push(colunaContainerId(col.id))
        walk(col.campos)
      }
    }
  }
  walk(campos)
  return ids
}

export function getContainer(campos: MapeadorCampo[], containerId: string): MapeadorCampo[] {
  if (containerId === ROOT_CONTAINER) return campos
  function walk(list: MapeadorCampo[]): MapeadorCampo[] | null {
    for (const c of list) {
      if (c.tipo !== "agrupamento") continue
      for (const col of c.colunas ?? []) {
        if (colunaContainerId(col.id) === containerId) return col.campos
        const found = walk(col.campos)
        if (found) return found
      }
    }
    return null
  }
  return walk(campos) ?? []
}

export function setContainer(campos: MapeadorCampo[], containerId: string, items: MapeadorCampo[]): MapeadorCampo[] {
  if (containerId === ROOT_CONTAINER) return items
  function walk(list: MapeadorCampo[]): MapeadorCampo[] {
    return list.map((c) => {
      if (c.tipo !== "agrupamento") return c
      const colunas = (c.colunas ?? []).map((col) =>
        colunaContainerId(col.id) === containerId ? { ...col, campos: items } : { ...col, campos: walk(col.campos) }
      )
      return { ...c, colunas }
    })
  }
  return walk(campos)
}

export function findContainerOf(campos: MapeadorCampo[], campoId: string): string | null {
  if (campos.some((c) => c.id === campoId)) return ROOT_CONTAINER
  function walk(list: MapeadorCampo[]): string | null {
    for (const c of list) {
      if (c.tipo !== "agrupamento") continue
      for (const col of c.colunas ?? []) {
        if (col.campos.some((cf) => cf.id === campoId)) return colunaContainerId(col.id)
        const found = walk(col.campos)
        if (found) return found
      }
    }
    return null
  }
  return walk(campos)
}

/**
 * True when `containerId` is one of `campo`'s own nested coluna containers, at any depth — used to
 * stop an agrupamento from being dragged into one of its own descendants, which would nest it
 * inside itself and corrupt the tree.
 */
export function isContainerWithin(campo: MapeadorCampo, containerId: string): boolean {
  if (campo.tipo !== "agrupamento") return false
  for (const col of campo.colunas ?? []) {
    if (colunaContainerId(col.id) === containerId) return true
    if (col.campos.some((child) => isContainerWithin(child, containerId))) return true
  }
  return false
}
