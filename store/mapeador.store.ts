import { create } from "zustand"
import type { CamposPorEtapa, MapeadorEtapaDTO, MapeadorProjetoDTO } from "@/types/mapeador"

export type MapeadorTab = "mapeamento" | "informacoes" | "visualizador" | "prototipo"

interface MapeadorState {
  projeto: MapeadorProjetoDTO | null
  activeTab: MapeadorTab
  selectedEtapaId: string | null
  hydrate: (projeto: MapeadorProjetoDTO) => void
  setActiveTab: (tab: MapeadorTab) => void
  setSelectedEtapaId: (id: string | null) => void
  setEtapas: (etapas: MapeadorEtapaDTO[]) => void
  patchEtapa: (etapaId: string, patch: Partial<Omit<MapeadorEtapaDTO, "id">>) => void
  setCamposPorEtapa: (etapaId: string, campos: CamposPorEtapa) => void
  patchInformacoesAdicionais: (patch: Partial<MapeadorProjetoDTO["informacoesAdicionais"]>) => void
  patchPrototipoConfig: (patch: Partial<MapeadorProjetoDTO["prototipoConfig"]>) => void
  setNome: (nome: string) => void
}

export const useMapeadorStore = create<MapeadorState>((set) => ({
  projeto: null,
  activeTab: "mapeamento",
  selectedEtapaId: null,

  hydrate: (projeto) =>
    set({
      projeto,
      selectedEtapaId: projeto.etapas[0]?.id ?? null,
      activeTab: "mapeamento",
    }),

  setActiveTab: (activeTab) => set({ activeTab }),
  setSelectedEtapaId: (selectedEtapaId) => set({ selectedEtapaId }),

  setEtapas: (etapas) =>
    set((state) => (state.projeto ? { projeto: { ...state.projeto, etapas } } : state)),

  patchEtapa: (etapaId, patch) =>
    set((state) => {
      if (!state.projeto) return state
      return {
        projeto: {
          ...state.projeto,
          etapas: state.projeto.etapas.map((etapa) => (etapa.id === etapaId ? { ...etapa, ...patch } : etapa)),
        },
      }
    }),

  setCamposPorEtapa: (etapaId, campos) =>
    set((state) => {
      if (!state.projeto) return state
      return {
        projeto: {
          ...state.projeto,
          etapas: state.projeto.etapas.map((etapa) =>
            etapa.id === etapaId ? { ...etapa, camposPorEtapa: campos } : etapa
          ),
        },
      }
    }),

  patchInformacoesAdicionais: (patch) =>
    set((state) => {
      if (!state.projeto) return state
      return { projeto: { ...state.projeto, informacoesAdicionais: { ...state.projeto.informacoesAdicionais, ...patch } } }
    }),

  patchPrototipoConfig: (patch) =>
    set((state) => {
      if (!state.projeto) return state
      return { projeto: { ...state.projeto, prototipoConfig: { ...state.projeto.prototipoConfig, ...patch } } }
    }),

  setNome: (nome) =>
    set((state) => (state.projeto ? { projeto: { ...state.projeto, nome } } : state)),
}))
