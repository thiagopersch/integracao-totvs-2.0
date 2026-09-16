import type { MapeadorProjetoDTO } from "@/types/mapeador"

export type PrototipoScreen =
  | { kind: "landing" }
  | { kind: "form"; projetoIndex: number; etapaIndex: number; passoIndex: number }
  | { kind: "portal"; projetoIndex: number; etapaIndex: number }

export function buildScreens(projetos: MapeadorProjetoDTO[]): PrototipoScreen[] {
  const screens: PrototipoScreen[] = [{ kind: "landing" }]

  projetos.forEach((projeto, projetoIndex) => {
    projeto.etapas.forEach((etapa, etapaIndex) => {
      etapa.camposPorEtapa.forEach((_, passoIndex) => {
        screens.push({ kind: "form", projetoIndex, etapaIndex, passoIndex })
      })
      if (etapa.camposPorEtapa.length === 0) {
        // Still give an empty etapa a screen so it's reachable/visible in the flow.
        screens.push({ kind: "form", projetoIndex, etapaIndex, passoIndex: 0 })
      }
      screens.push({ kind: "portal", projetoIndex, etapaIndex })
    })
  })

  return screens
}

export function screenLabel(screen: PrototipoScreen, projetos: MapeadorProjetoDTO[]): string {
  if (screen.kind === "landing") return "Seleção do processo seletivo"
  const projeto = projetos[screen.projetoIndex]
  const etapa = projeto?.etapas[screen.etapaIndex]
  if (!etapa) return "—"
  if (screen.kind === "portal") return `Portal do candidato — após "${etapa.nome}"`
  const passo = etapa.camposPorEtapa[screen.passoIndex]
  return `${etapa.nome} › ${passo?.titulo || "Passo"}`
}

export function findFormScreenIndex(
  screens: PrototipoScreen[],
  projetoIndex: number,
  etapaId: string,
  projetos: MapeadorProjetoDTO[]
): number {
  const etapaIndex = projetos[projetoIndex]?.etapas.findIndex((e) => e.id === etapaId) ?? -1
  if (etapaIndex === -1) return -1
  return screens.findIndex((s) => s.kind === "form" && s.projetoIndex === projetoIndex && s.etapaIndex === etapaIndex && s.passoIndex === 0)
}
