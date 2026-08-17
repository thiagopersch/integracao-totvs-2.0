import { create } from "zustand"
import type { SoapMethod } from "@prisma/client"

interface SoapBuilderState {
  dataserver: string
  process: string
  method: SoapMethod
  xml: string
  context: {
    coligate: number
    branch: number
    levelEducation: number
    codSystem: string
    user: string
  }
  timeout: number
  response: {
    xml: string
    json: Record<string, unknown> | null
    duration: number | null
    status: number | null
  } | null
  setDataserver: (dataserver: string) => void
  setProcess: (process: string) => void
  setMethod: (method: SoapMethod) => void
  setXml: (xml: string) => void
  setContext: (context: Partial<SoapBuilderState["context"]>) => void
  setTimeout: (timeout: number) => void
  setResponse: (response: SoapBuilderState["response"]) => void
  reset: () => void
}

const initialState = {
  dataserver: "",
  process: "",
  method: "GETSCHEMA" as SoapMethod,
  xml: "",
  context: {
    coligate: 1,
    branch: 1,
    levelEducation: 1,
    codSystem: "",
    user: "",
  },
  timeout: 30000,
  response: null,
}

export const useSoapStore = create<SoapBuilderState>((set) => ({
  ...initialState,
  setDataserver: (dataserver) => set({ dataserver }),
  setProcess: (process) => set({ process }),
  setMethod: (method) => set({ method }),
  setXml: (xml) => set({ xml }),
  setContext: (context) => set((state) => ({ context: { ...state.context, ...context } })),
  setTimeout: (timeout) => set({ timeout }),
  setResponse: (response) => set({ response }),
  reset: () => set(initialState),
}))
