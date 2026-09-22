/**
 * True when a tema/protótipo's snapshotted brand color/logo/background no longer matches
 * the linked Client's current visual identity — i.e. the client's registration was edited
 * after the snapshot was taken. Used to drive the "identidade visual alterada" warning banner
 * instead of ever re-reading the client live (the snapshot is what actually renders).
 */
export function clienteIdentidadeMudou(
  snapshot: { corMarca?: string; logoUrl?: string | null; bgImageUrl?: string | null },
  cliente: { color: string; image: string | null; background: string | null },
): boolean {
  return (
    snapshot.corMarca !== cliente.color ||
    (snapshot.logoUrl ?? null) !== (cliente.image ?? null) ||
    (snapshot.bgImageUrl ?? null) !== (cliente.background ?? null)
  )
}
