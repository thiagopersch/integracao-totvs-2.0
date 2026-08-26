import { create } from "zustand"

type SoapBuilderResponse = {
  xmlResponse: string
  jsonResponse: Record<string, unknown>
  duration: number
  status: number
} | null

interface SoapBuilderContext {
  coligate: number
  branch: number
  levelEducation: number
  codSystem: string
  user: string
}

interface SoapBuilderState {
  selectedTypeId: string
  selectedMethodId: string
  selectedSistemaId: string
  selectedClientId: string
  selectedTbcId: string
  xmlContent: string
  jsonContent: string
  activeTab: string
  context: SoapBuilderContext
  timeout: number
  response: SoapBuilderResponse
  error: string | null
  setSelectedTypeId: (id: string) => void
  setSelectedMethodId: (id: string) => void
  setSelectedSistemaId: (id: string) => void
  setSelectedClientId: (id: string) => void
  setSelectedTbcId: (id: string) => void
  setXmlContent: (xml: string) => void
  setJsonContent: (json: string) => void
  setActiveTab: (tab: string) => void
  setContext: (context: Partial<SoapBuilderContext>) => void
  setTimeout: (timeout: number) => void
  setResponse: (response: SoapBuilderResponse) => void
  setError: (error: string | null) => void
  reset: () => void
}

const initialState = {
  selectedTypeId: "",
  selectedMethodId: "",
  selectedSistemaId: "",
  selectedClientId: "",
  selectedTbcId: "",
  xmlContent: "<GetSchema />",
  jsonContent: "{}",
  activeTab: "xml",
  context: {
    coligate: 1,
    branch: 1,
    levelEducation: 1,
    codSystem: "",
    user: "",
  },
  timeout: 30000,
  response: null,
  error: null,
}

export const useSoapStore = create<SoapBuilderState>((set) => ({
  ...initialState,
  setSelectedTypeId: (selectedTypeId) => set({ selectedTypeId }),
  setSelectedMethodId: (selectedMethodId) => set({ selectedMethodId }),
  setSelectedSistemaId: (selectedSistemaId) => set({ selectedSistemaId }),
  setSelectedClientId: (selectedClientId) => set({ selectedClientId }),
  setSelectedTbcId: (selectedTbcId) => set({ selectedTbcId }),
  setXmlContent: (xmlContent) => set({ xmlContent }),
  setJsonContent: (jsonContent) => set({ jsonContent }),
  setActiveTab: (activeTab) => set({ activeTab }),
  setContext: (context) => set((state) => ({ context: { ...state.context, ...context } })),
  setTimeout: (timeout) => set({ timeout }),
  setResponse: (response) => set({ response }),
  setError: (error) => set({ error }),
  reset: () => set(initialState),
}))
