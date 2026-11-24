"use client"

import { listComparePortals } from "@/actions/integrations/ps-compare"
import { listPortalSelectiveProcesses } from "@/actions/integrations/ps-portal-docs"
import { CompareResultView } from "@/components/ps-compare/compare-result"
import { ProcessPicker, type Portal } from "@/components/ps-compare/process-picker"
import { CredentialsFields } from "@/components/ps-docs/credentials-fields"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Field, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { compareProcesses } from "@/lib/ps-compare/compare"
import type { CompareResult } from "@/lib/ps-compare/types"
import { loadProcessDoc } from "@/lib/ps-docs/client/load-process-doc"
import { hasRequiredCredentials, missingCookieNames, parseCookieString } from "@/lib/ps-docs/credential"
import type { PortalProcessRef } from "@/lib/ps-docs/types"
import { toast } from "@/lib/toast"
import { AlertTriangle, Building2, GitCompare, Loader2 } from "lucide-react"
import { useMemo, useRef, useState } from "react"

type SideKey = "a" | "b"
interface SideState {
  portalId: string
  processes: PortalProcessRef[] | null
  loadingProcesses: boolean
  psId: string
  progress: { done: number; total: number } | null
}
function isHttpUrl(value: string): boolean {
  try {
    const u = new URL(value)
    return u.protocol === "http:" || u.protocol === "https:"
  } catch {
    return false
  }
}

const emptySide = (): SideState => ({ portalId: "", processes: null, loadingProcesses: false, psId: "", progress: null })

export default function ComparePsPage() {
  const [cookie, setCookie] = useState("")
  const [crmDomain, setCrmDomain] = useState("")
  const [portals, setPortals] = useState<Portal[] | null>(null)
  const [loadingPortals, setLoadingPortals] = useState(false)
  const [sides, setSides] = useState<Record<SideKey, SideState>>({ a: emptySide(), b: emptySide() })
  const [comparing, setComparing] = useState(false)
  const [result, setResult] = useState<CompareResult | null>(null)
  const [warnings, setWarnings] = useState<string[]>([])
  const [error, setError] = useState<string | null>(null)
  // Ignore process lists that arrive after the user already switched portals.
  const processRequest = useRef<Record<SideKey, number>>({ a: 0, b: 0 })

  const credentials = useMemo(() => parseCookieString(cookie), [cookie])
  const crmInvalid = !!crmDomain.trim() && !isHttpUrl(crmDomain.trim())
  const cookieReady = !!cookie.trim() && missingCookieNames(cookie).length === 0 && hasRequiredCredentials(credentials)

  const patchSide = (key: SideKey, patch: Partial<SideState>) => setSides((prev) => ({ ...prev, [key]: { ...prev[key], ...patch } }))

  async function loadPortals() {
    if (!cookieReady) return void toast.error("Cole o cookie completo da sessão do portal admin")
    setLoadingPortals(true)
    try {
      const res = await listComparePortals({ credentials })
      if (!res.success) return void toast.error(res.error)
      setPortals(res.portals)
      if (res.warning) toast.warning(res.warning)
    } catch (e) {
      toast.error((e as Error).message)
    } finally {
      setLoadingPortals(false)
    }
  }

  async function selectPortal(key: SideKey, portalId: string) {
    const request = ++processRequest.current[key]
    patchSide(key, { portalId, psId: "", processes: null, progress: null, loadingProcesses: !!portalId })
    if (!portalId) return
    try {
      const res = await listPortalSelectiveProcesses({ credentials, idPortal: portalId })
      if (request !== processRequest.current[key]) return
      if (!res.success || !res.processes) {
        toast.error(res.error || "Erro ao listar os processos seletivos do portal")
        patchSide(key, { loadingProcesses: false, processes: [] })
        return
      }
      const processes = [...res.processes].sort((x, y) => x.name.localeCompare(y.name, "pt-BR"))
      patchSide(key, { loadingProcesses: false, processes })
      if (processes.length === 0) toast.warning("Nenhum processo seletivo ativo encontrado no portal")
    } catch (e) {
      if (request === processRequest.current[key]) patchSide(key, { loadingProcesses: false, processes: [] })
      toast.error((e as Error).message)
    }
  }

  async function compare() {
    if (!cookieReady) return void toast.error("Cole o cookie completo da sessão do portal admin")
    if (!sides.a.psId || !sides.b.psId) return void toast.error("Selecione o processo seletivo dos dois lados")
    if (crmInvalid) return void toast.error("Informe um link do CRM válido (ex: https://crm.exemplo.com.br/)")

    setComparing(true)
    setError(null)
    setResult(null)
    setWarnings([])
    try {
      const docs = []
      const allWarnings: string[] = []
      // One side after the other — server actions are serialized anyway, and it keeps the progress readable.
      for (const key of ["a", "b"] as const) {
        const side = sides[key]
        const ref = side.processes?.find((p) => p.id === side.psId)
        patchSide(key, { progress: { done: 0, total: 0 } })
        const res = await loadProcessDoc({
          credentials,
          idPs: side.psId,
          crmDomain: crmDomain.trim() || undefined,
          fallbackTitle: ref?.name,
          fallbackIdPortal: side.portalId,
          onStart: (_doc, total) => patchSide(key, { progress: { done: 0, total } }),
          onStage: (_doc, done, total) => patchSide(key, { progress: { done, total } }),
        })
        if (!res.success) {
          const msg = `PS ${key.toUpperCase()}: ${res.error}`
          setError(msg)
          toast.error(msg)
          patchSide(key, { progress: null })
          return
        }
        docs.push(res.doc)
        allWarnings.push(...res.warnings.map((w) => `PS ${key.toUpperCase()} — ${w}`))
      }

      const portalTitle = (key: SideKey) => portals?.find((p) => String(p.id) === sides[key].portalId)?.title
      const processName = (key: SideKey) => sides[key].processes?.find((p) => p.id === sides[key].psId)?.name
      const res = compareProcesses(docs[0], docs[1], {
        a: { portal: portalTitle("a"), processo: processName("a") },
        b: { portal: portalTitle("b"), processo: processName("b") },
      })
      setResult(res)
      setWarnings(allWarnings)
      toast.success("Comparação concluída")
      if (allWarnings.length > 0) toast.warning(`${allWarnings.length} aviso(s) durante a leitura da estrutura — confira o resultado.`)
    } catch (e) {
      setError((e as Error).message)
      toast.error((e as Error).message)
    } finally {
      setComparing(false)
    }
  }

  const sameProcess = !!sides.a.psId && sides.a.psId === sides.b.psId

  return (
    <div className="space-y-4 p-4 md:p-6">
      <div>
        <h1 className="flex items-center gap-2 text-2xl font-bold">
          <GitCompare className="h-5 w-5" /> Comparar processos
        </h1>
        <p className="text-sm text-muted-foreground">
          Compare dois processos seletivos (do mesmo portal ou de portais diferentes): etapas, passos, componentes, campos e feedbacks, com todas
          as propriedades de cada um. O resultado é um checklist do que está igual, diferente ou só existe de um lado.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Sessão do portal admin</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <CredentialsFields value={cookie} onChange={setCookie} />
          <Field>
            <FieldLabel htmlFor="crmDomain">Link do CRM</FieldLabel>
            <Input
              id="crmDomain"
              value={crmDomain}
              onChange={(e) => setCrmDomain(e.target.value)}
              placeholder="Ex: https://crmtoledo.apprubeus.com.br/"
              aria-invalid={crmInvalid}
              disabled={comparing}
            />
            {crmInvalid ? (
              <p className="text-sm text-destructive">Informe um link válido (ex: https://crm.exemplo.com.br/)</p>
            ) : (
              <p className="text-xs text-muted-foreground">Usado para resolver o nome dos eventos Rubeus nas ações dos botões.</p>
            )}
          </Field>
          <div className="flex flex-wrap items-center gap-2">
            <Button variant="outline" onClick={loadPortals} disabled={!cookieReady || loadingPortals || comparing}>
              {loadingPortals ? <Loader2 className="size-4 animate-spin" /> : <Building2 className="size-4" />}
              {portals ? "Recarregar portais" : "Carregar portais"}
            </Button>
            {portals && <span className="text-sm text-muted-foreground">{portals.length} portal(is) ativo(s)</span>}
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {(["a", "b"] as const).map((key) => (
          <ProcessPicker
            key={key}
            title={key === "a" ? "PS A — referência" : "PS B — a ajustar"}
            description={key === "a" ? "O processo usado como modelo." : "O processo que será comparado com o modelo."}
            portals={portals}
            loadingPortals={loadingPortals}
            portalId={sides[key].portalId}
            onPortalChange={(id) => selectPortal(key, id)}
            processes={sides[key].processes}
            loadingProcesses={sides[key].loadingProcesses}
            psId={sides[key].psId}
            onPsChange={(id) => patchSide(key, { psId: id, progress: null })}
            progress={sides[key].progress}
            disabled={comparing}
          />
        ))}
      </div>

      <div className="flex flex-col items-center gap-2">
        <Button onClick={compare} disabled={comparing || crmInvalid || !cookieReady || !sides.a.psId || !sides.b.psId}>
          {comparing ? <Loader2 className="size-4 animate-spin" /> : <GitCompare className="size-4" />} Comparar
        </Button>
        {sameProcess && <span className="text-sm text-muted-foreground">O mesmo processo foi escolhido dos dois lados.</span>}
      </div>

      {error && (
        <div className="flex items-start gap-2 rounded-md border border-destructive/40 bg-destructive/5 p-3 text-sm text-destructive">
          <AlertTriangle className="mt-0.5 size-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {warnings.length > 0 && (
        <details className="rounded-md border border-amber-500/40 bg-amber-500/5 p-3 text-sm">
          <summary className="cursor-pointer font-medium">{warnings.length} aviso(s) durante a leitura da estrutura</summary>
          <ul className="mt-2 list-disc space-y-1 pl-5 text-muted-foreground">
            {warnings.map((w, i) => (
              <li key={i}>{w}</li>
            ))}
          </ul>
        </details>
      )}

      {result && <CompareResultView result={result} />}
    </div>
  )
}
