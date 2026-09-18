import type { MapeadorTemaConfig } from "@/types/mapeador"

/**
 * Starting values for the org's editable "Padrão" tema (`mapeadorTemaService.getOrCreatePadrao`)
 * and for the "new tema" form (`tema-editor-dialog.tsx`) — kept in one place so both stay in sync
 * instead of duplicating the same literals in client and server code.
 */
export const MAPEADOR_TEMA_PADRAO_CONFIG: MapeadorTemaConfig = {
  corMarca: "#0CC1AA",
  corBarra: "#0AA392",
  campoCor: "rgba(0,0,0,.04)",
  campoRaio: 0,
  botaoCor: "#0CC1AA",
  botaoRaio: 5,
}
