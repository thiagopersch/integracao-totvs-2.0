/** One menu access of an RM profile — `code` as printed in the "Relatório de permissões dos
 *  perfis" (e.g. "02.01.01.01"); its depth in the menu tree is the number of dots. */
export type ReferenceAccess = { code: string; label: string }

/** An RM profile as the reference model expects it to be configured. The client's actual profile
 *  code varies, so `suggestedCodPerfil` is only a hint — the screen matches the real one by coverage. */
export type ReferenceProfile = {
  key: string
  label: string
  /** RM system code (GUSRPERFIL.CODSISTEMA): S = Classis .Net, F = Fluxus, B = Testis… */
  codSistema: string
  suggestedCodPerfil: string
  /** Source document the accesses were transcribed from. */
  source: string
  accesses: ReferenceAccess[]
}

/** A Data Server the model needs readable through the TBC — tested with GetSchema + ReadView `1=0`. */
export type DataserverProbe = { code: string; label: string; group: string }

export type PermissionModel = {
  key: string
  label: string
  profiles: ReferenceProfile[]
  dataservers: DataserverProbe[]
}

export function accessDepth(code: string): number {
  return code.split(".").length - 1
}
