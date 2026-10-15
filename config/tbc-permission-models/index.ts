import type { PermissionModel } from "@/config/tbc-permission-models/types"
import { CAPTACAO_MODEL } from "@/config/tbc-permission-models/captacao"

/** Reference permission models a TBC user can be validated against. Inadimplência and Renovação de
 *  Matrícula come next — each one is a folder like `captacao/` built from the client's PDFs. */
export const PERMISSION_MODELS: PermissionModel[] = [CAPTACAO_MODEL]

/** RM system code → name, as printed in the report title ("…dos perfis do RM CLASSIS NET"). */
export const RM_SYSTEM_NAMES: Record<string, string> = {
  S: "Classis .Net (Educacional)",
  F: "Fluxus (Financeiro)",
  B: "Testis (Avaliação e Pesquisa)",
}
