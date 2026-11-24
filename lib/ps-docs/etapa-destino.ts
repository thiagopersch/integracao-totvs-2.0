import type { EtapaDestinoSpec } from "@/lib/ps-docs/types";

/** "Etapa: X (processo seletivo P, portal Y)" — the full reference of a "Para outra etapa"
 *  encaminhamento. Pure (no server imports): used by the redirect resolver and by the comparator. */
export function describeEtapaDestino(d: EtapaDestinoSpec): string {
  return `Etapa: ${d.etapa} (processo seletivo ${d.processo}${d.portal ? `, portal ${d.portal}` : ""})`;
}
