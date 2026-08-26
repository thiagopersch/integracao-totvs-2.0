import { create } from "zustand"
import type { TbcReportListItem, RptReportPar } from "@/utils/tbc-report-parser"

export type ReportStepKey = "list" | "info" | "generate" | "poll" | "download"
export type ReportStepStatus = "pending" | "running" | "done" | "error"

export type ReportStep = {
  key: ReportStepKey
  label: string
  status: ReportStepStatus
  detail?: string
}

type DownloadResult = { base64: string; byteLength: number; fileName: string } | null

interface TbcReportState {
  selectedTbcId: string
  codColigada: number
  reports: TbcReportListItem[]
  selectedReport: TbcReportListItem | null
  reportInfo: { filters: RptReportPar[]; parameters: RptReportPar[] } | null
  filters: RptReportPar[]
  parameters: RptReportPar[]
  fileName: string
  steps: ReportStep[]
  deadline: number | null
  guid: string | null
  generationMode: "async" | "sync" | null
  downloadResult: DownloadResult
  loading: boolean
  error: string | null

  setSelectedTbcId: (id: string) => void
  setCodColigada: (value: number) => void
  setReports: (reports: TbcReportListItem[]) => void
  setSelectedReport: (report: TbcReportListItem | null) => void
  setReportInfo: (info: { filters: RptReportPar[]; parameters: RptReportPar[] } | null) => void
  setFilters: (filters: RptReportPar[]) => void
  setParameters: (parameters: RptReportPar[]) => void
  setFileName: (name: string) => void
  resetSteps: () => void
  updateStep: (key: ReportStepKey, patch: Partial<Omit<ReportStep, "key">>) => void
  setDeadline: (deadline: number | null) => void
  setGuid: (guid: string | null) => void
  setGenerationMode: (mode: "async" | "sync" | null) => void
  setDownloadResult: (result: DownloadResult) => void
  setLoading: (loading: boolean) => void
  setError: (error: string | null) => void
  reset: () => void
}

const STEP_LABELS: Record<ReportStepKey, string> = {
  list: "Listar relatórios",
  info: "Buscar filtros e parâmetros",
  generate: "Gerar relatório",
  poll: "Verificar status da geração",
  download: "Baixar arquivo",
}

function freshSteps(): ReportStep[] {
  return (Object.keys(STEP_LABELS) as ReportStepKey[]).map((key) => ({
    key,
    label: STEP_LABELS[key],
    status: "pending",
  }))
}

const initialState = {
  selectedTbcId: "",
  codColigada: 1,
  reports: [],
  selectedReport: null,
  reportInfo: null,
  filters: [],
  parameters: [],
  fileName: "Relatorio.pdf",
  steps: freshSteps(),
  deadline: null,
  guid: null,
  generationMode: null,
  downloadResult: null,
  loading: false,
  error: null,
}

export const useTbcReportStore = create<TbcReportState>((set) => ({
  ...initialState,
  setSelectedTbcId: (selectedTbcId) => set({ selectedTbcId }),
  setCodColigada: (codColigada) => set({ codColigada }),
  setReports: (reports) => set({ reports }),
  setSelectedReport: (selectedReport) => set({ selectedReport }),
  setReportInfo: (reportInfo) =>
    set({ reportInfo, filters: reportInfo?.filters ?? [], parameters: reportInfo?.parameters ?? [] }),
  setFilters: (filters) => set({ filters }),
  setParameters: (parameters) => set({ parameters }),
  setFileName: (fileName) => set({ fileName }),
  resetSteps: () => set({ steps: freshSteps() }),
  updateStep: (key, patch) =>
    set((state) => ({
      steps: state.steps.map((step) => (step.key === key ? { ...step, ...patch } : step)),
    })),
  setDeadline: (deadline) => set({ deadline }),
  setGuid: (guid) => set({ guid }),
  setGenerationMode: (generationMode) => set({ generationMode }),
  setDownloadResult: (downloadResult) => set({ downloadResult }),
  setLoading: (loading) => set({ loading }),
  setError: (error) => set({ error }),
  reset: () => set({ ...initialState, steps: freshSteps() }),
}))
