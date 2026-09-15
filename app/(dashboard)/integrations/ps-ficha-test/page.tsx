"use client"

import { useRef, useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { PasswordInput } from "@/components/ui/password-input"
import { Field, FieldLabel } from "@/components/ui/field"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Checkbox } from "@/components/ui/checkbox"
import { Label } from "@/components/ui/label"
import { Accordion, AccordionItem, AccordionTrigger, AccordionContent } from "@/components/ui/accordion"
import { MultiTypeChart } from "@/components/shared/charts/multi-type-chart"
import { FlaskConical, Loader2, CheckCircle2, AlertCircle, Clock, AlertTriangle, MousePointerClick, Pause, Play, Square, MinusCircle } from "lucide-react"
import { toast } from "sonner"
import { listSelectiveProcessStages, fetchStageDocumentation } from "@/actions/integrations/ps-docs"
import { testFichaPageReachability } from "@/actions/integrations/ps-ficha-test"
import { startFichaAutomationRun, runAutomationCheck, finalizeFichaAutomationRun } from "@/actions/integrations/ps-ficha-automation"
import type { PlannedCheck } from "@/lib/ps-ficha-automation/test-plan"
import type { RuleCheck } from "@/lib/ps-ficha-automation/browser-engine"
import { countUnresolvedFieldPlaceholders } from "@/lib/ps-docs/parse-structure"
import { ERROR_KIND_LABELS, ERROR_KIND_BADGE_VARIANT, type ErrorKind } from "@/lib/error-kind"

type CheckStatus = "pending" | "running" | "success" | "failed" | "skipped"

interface CheckItem {
  id: string
  label: string
  status: CheckStatus
  durationMs?: number
  message?: string
  error?: string
  warnings?: string[]
}

/** Uma checagem do plano de testes (`PlannedCheck`) + o resultado da execução, quando já rodou. */
interface AutomationCheckItem extends PlannedCheck {
  status: CheckStatus
  resultValue?: string
  resultReason?: string
  ruleCheck?: RuleCheck
  revealOutcome?: { revealed: number[]; stillHidden: number[] }
  pendingConfirmation?: boolean
}

const CHECK_KIND_LABELS: Record<PlannedCheck["kind"], string> = {
  preencher: "Preencher",
  "formato-invalido": "Testar formato inválido",
  "campo-obrigatorio-vazio": "Testar campo obrigatório vazio",
  "revelar-condicionais": "Revelar campos condicionais",
  avancar: "Avançar",
}

/** Heurística client-side só para exibição — a classificação real (`classifyError`) já acontece
 *  no servidor, dentro das actions, para fins de log/notificação. Aqui só extraímos um "tipo de
 *  erro" aproximado a partir da mensagem já formatada que a action devolveu (ex: "HTTP 401 ao
 *  consultar..."), para reaproveitar o mesmo badge visual usado nas notificações de falha. */
function guessErrorKind(message?: string): ErrorKind {
  if (!message) return "unknown"
  const httpMatch = message.match(/HTTP (\d{3})/)
  if (httpMatch) {
    const status = Number(httpMatch[1])
    if (status === 401 || status === 403) return "auth"
    if (status >= 400) return "http"
  }
  if (/timeout/i.test(message)) return "timeout"
  if (/ECONNREFUSED|ENOTFOUND|ECONNRESET|EHOSTUNREACH|ENETUNREACH|conex[ãa]o/i.test(message)) return "connection"
  return "unknown"
}

function StatusIcon({ status }: { status: CheckStatus }) {
  if (status === "success") return <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
  if (status === "failed") return <AlertCircle className="h-3.5 w-3.5 text-destructive" />
  if (status === "skipped") return <MinusCircle className="h-3.5 w-3.5 text-muted-foreground" />
  if (status === "running") return <Loader2 className="h-3.5 w-3.5 animate-spin" />
  return <Clock className="h-3.5 w-3.5 text-muted-foreground" />
}

export default function PsFichaTestPage() {
  const [tokenPs, setTokenPs] = useState("")
  const [idPs, setIdPs] = useState("")
  const [pageUrl, setPageUrl] = useState("")
  const [crmDomain, setCrmDomain] = useState("")

  const [running, setRunning] = useState(false)
  const [aborted, setAborted] = useState(false)
  const [checks, setChecks] = useState<CheckItem[]>([])

  const [confirmFinalSubmit, setConfirmFinalSubmit] = useState(false)
  const [automationRunning, setAutomationRunning] = useState(false)
  const [automationPaused, setAutomationPaused] = useState(false)
  const [automationAborted, setAutomationAborted] = useState(false)
  const [automationRunId, setAutomationRunId] = useState<string | null>(null)
  const [automationChecks, setAutomationChecks] = useState<AutomationCheckItem[]>([])
  const [openGroups, setOpenGroups] = useState<string[]>([])
  /** Sinal de controle lido dentro do loop assíncrono — precisa ser `ref`, não `state`, porque o
   *  loop já está rodando com o valor de `state` capturado no fechamento (closure) da chamada
   *  anterior; um `ref` sempre reflete o clique mais recente do usuário. */
  const controlRef = useRef<"run" | "pause" | "stop">("run")

  function updateCheck(id: string, patch: Partial<CheckItem>) {
    setChecks((prev) => prev.map((c) => (c.id === id ? { ...c, ...patch } : c)))
  }

  function updateAutomationCheck(id: string, patch: Partial<AutomationCheckItem>) {
    setAutomationChecks((prev) => prev.map((c) => (c.id === id ? { ...c, ...patch } : c)))
  }

  /** Abre sozinho o grupo (passo) da checagem que está rodando agora — chamado no mesmo ponto que
   *  marca a checagem como "running", em vez de derivar isso num efeito (o Accordion é controlado
   *  via `value`/`onValueChange`, então isso só atualiza o estado que já é a fonte da verdade). */
  function ensureGroupOpen(check: PlannedCheck) {
    const key = `${check.etapaIndex}-${check.passoIndex}`
    setOpenGroups((prev) => (prev.includes(key) ? prev : [...prev, key]))
  }

  async function handleRunTests(e: React.FormEvent) {
    e.preventDefault()
    if (!tokenPs.trim() || !idPs.trim()) {
      toast.error("Informe o Token PS e o ID do Processo Seletivo")
      return
    }

    setRunning(true)
    setAborted(false)

    const initial: CheckItem[] = []
    if (pageUrl.trim()) initial.push({ id: "page", label: "Conectividade da página pública da ficha", status: "pending" })
    initial.push({ id: "discovery", label: "Autenticação e descoberta do processo seletivo", status: "pending" })
    setChecks(initial)

    try {
      if (pageUrl.trim()) {
        updateCheck("page", { status: "running" })
        const pageRes = await testFichaPageReachability({ pageUrl: pageUrl.trim() })
        if (!pageRes.success) {
          updateCheck("page", { status: "failed", durationMs: pageRes.durationMs, error: pageRes.error })
          setAborted(true)
          toast.error(`Falha ao acessar a página da ficha: ${pageRes.error}`)
          return
        }
        updateCheck("page", { status: "success", durationMs: pageRes.durationMs, message: `HTTP ${pageRes.httpStatus}` })
      }

      updateCheck("discovery", { status: "running" })
      const discoveryStart = Date.now()
      const listRes = await listSelectiveProcessStages({ tokenPs, idPs, crmDomain: crmDomain.trim() || undefined })
      const discoveryDuration = Date.now() - discoveryStart
      if (!listRes.success || !listRes.stages || !listRes.fieldCatalogEntries) {
        updateCheck("discovery", { status: "failed", durationMs: discoveryDuration, error: listRes.error || "Erro ao consultar o processo seletivo" })
        setAborted(true)
        toast.error(listRes.error || "Erro ao consultar o processo seletivo")
        return
      }
      updateCheck("discovery", {
        status: "success",
        durationMs: discoveryDuration,
        message: `Processo "${listRes.tituloPortal ?? idPs}" — ${listRes.stages.length} etapa(s) ativa(s) encontrada(s)`,
        warnings: listRes.catalogWarnings,
      })

      const stageChecks: CheckItem[] = listRes.stages.map((s, i) => ({ id: `stage-${i}`, label: `Etapa: ${s.label}`, status: "pending" as const }))
      setChecks((prev) => [...prev, ...stageChecks])

      for (let i = 0; i < listRes.stages.length; i++) {
        const stage = listRes.stages[i]
        const id = `stage-${i}`
        updateCheck(id, { status: "running" })
        const stageStart = Date.now()
        const stageRes = await fetchStageDocumentation({
          tokenPs,
          idPs,
          stage: stage.ref,
          fieldCatalogEntries: listRes.fieldCatalogEntries,
          actionCatalogEntries: listRes.actionCatalogEntries,
        })
        const stageDuration = Date.now() - stageStart
        if (!stageRes.success || !stageRes.etapa) {
          updateCheck(id, { status: "failed", durationMs: stageDuration, error: stageRes.error || "Falha ao consultar a etapa" })
          setAborted(true)
          toast.error(`Falha na etapa "${stage.label}": ${stageRes.error ?? "erro desconhecido"}`)
          return
        }
        const unresolved = countUnresolvedFieldPlaceholders(stageRes.etapa)
        updateCheck(id, {
          status: "success",
          durationMs: stageDuration,
          message: `${stageRes.etapa.passos.length} passo(s) — ${unresolved === 0 ? "todos os campos resolvidos" : `${unresolved} campo(s) não resolvido(s) (aparecem como "campo #id")`}`,
          warnings: stageRes.warnings,
        })
      }

      toast.success("Todos os testes concluídos com sucesso")
    } finally {
      setRunning(false)
    }
  }

  /** Roda o plano de testes a partir de um índice, uma checagem por vez, checando o sinal de
   *  controle (`controlRef`) antes de cada uma — permite Pausar/Parar no meio, e Retomar depois
   *  reaproveita a MESMA sessão de navegador (não chama `startFichaAutomationRun` de novo). */
  async function runChecksFrom(runId: string, startIndex: number, planList: AutomationCheckItem[]) {
    setAutomationRunning(true)
    setAutomationPaused(false)
    try {
      let i = startIndex
      while (i < planList.length) {
        if (controlRef.current === "stop") {
          setAutomationAborted(true)
          toast.warning("Automação interrompida pelo usuário")
          await finalizeFichaAutomationRun({ runId, reason: "stopped" })
          return
        }
        if (controlRef.current === "pause") {
          setAutomationPaused(true)
          toast("Automação pausada — clique em Retomar para continuar de onde parou")
          return
        }

        const check = planList[i]
        updateAutomationCheck(check.id, { status: "running" })
        ensureGroupOpen(check)
        const res = await runAutomationCheck({ runId, checkId: check.id, confirmFinalSubmit: confirmFinalSubmit })

        if (res.pendingConfirmation) {
          updateAutomationCheck(check.id, { status: "pending", pendingConfirmation: true })
          setAutomationRunId(runId)
          toast.warning('Pausado antes da confirmação final — marque "Confirmar inscrição real" e clique em "Confirmar e concluir".')
          return
        }

        if (!res.success) {
          updateAutomationCheck(check.id, { status: "failed", resultReason: res.error, ruleCheck: res.ruleCheck })
          setAutomationAborted(true)
          toast.error(res.error || "Falha na automação")
          await finalizeFichaAutomationRun({ runId, reason: "error" })
          return
        }

        updateAutomationCheck(check.id, {
          status: check.kind === "preencher" ? (res.fieldStatus ?? "success") : "success",
          resultValue: res.fieldValue,
          resultReason: res.fieldReason,
          ruleCheck: res.ruleCheck,
          revealOutcome: res.revealOutcome,
        })

        if (res.navigatedAway) {
          // A ficha avançou de passo sozinha (achado crítico de obrigatoriedade) — o resto das
          // checagens deste passo ficaria testando contra a página do passo ERRADO, então pula
          // pro início do próximo passo em vez de tentar continuar aqui.
          let j = i + 1
          while (j < planList.length && planList[j].etapaIndex === check.etapaIndex && planList[j].passoIndex === check.passoIndex) {
            updateAutomationCheck(planList[j].id, { status: "skipped", resultReason: "A ficha já avançou de passo antes desta checagem rodar" })
            j++
          }
          i = j
          continue
        }

        i += 1
      }

      await finalizeFichaAutomationRun({ runId, reason: "completed" })
      toast.success("Automação concluída")
    } finally {
      setAutomationRunning(false)
    }
  }

  /** Consulta a estrutura, monta o plano de testes completo (mostrado na tela ANTES de qualquer
   *  preenchimento real, por explícita instrução), abre o navegador e começa a executar. */
  async function handleStartAutomation() {
    if (!tokenPs.trim() || !idPs.trim() || !pageUrl.trim()) {
      toast.error("Informe o Token PS, o ID do Processo Seletivo e o Link da página para rodar a automação")
      return
    }

    controlRef.current = "run"
    setAutomationAborted(false)
    setAutomationPaused(false)
    setAutomationRunId(null)
    setAutomationRunning(true)
    setOpenGroups([])
    // Mostra alguma coisa já no clique — montar o plano de testes (que envolve buscar a estrutura
    // inteira da API) pode levar vários segundos antes de haver qualquer checagem pra listar.
    setAutomationChecks([
      { id: "starting", etapaIndex: 0, passoIndex: 0, etapaNome: "Preparando", passoNome: "Analisando a estrutura da ficha e montando o plano de testes...", label: "Preparando", kind: "preencher", status: "running" },
    ])

    try {
      const startRes = await startFichaAutomationRun({ tokenPs, idPs, pageUrl: pageUrl.trim(), crmDomain: crmDomain.trim() || undefined })
      if (!startRes.success || !startRes.runId || !startRes.testPlan) {
        updateAutomationCheck("starting", { status: "failed", resultReason: startRes.error || "Erro ao iniciar a automação" })
        setAutomationAborted(true)
        toast.error(startRes.error || "Erro ao iniciar a automação")
        return
      }

      // Plano completo, tudo "pendente" — aparece na tela antes de qualquer preenchimento real.
      const planItems: AutomationCheckItem[] = startRes.testPlan.map((c) => ({ ...c, status: "pending" }))
      setAutomationChecks(planItems)
      toast.success(`Plano de testes montado: ${planItems.length} checagem(ns). Iniciando...`)

      await runChecksFrom(startRes.runId, 0, planItems)
    } finally {
      setAutomationRunning(false)
    }
  }

  function handlePauseAutomation() {
    controlRef.current = "pause"
  }

  function handleStopAutomation() {
    controlRef.current = "stop"
  }

  /** Retoma uma execução pausada — reaproveita o MESMO `runId` e o MESMO plano já carregados na
   *  tela, só continua o loop a partir da primeira checagem ainda pendente. */
  async function handleResumeAutomation() {
    if (!automationRunId) return
    controlRef.current = "run"
    const startIndex = automationChecks.findIndex((c) => c.status === "pending" && !c.pendingConfirmation)
    if (startIndex === -1) return
    await runChecksFrom(automationRunId, startIndex, automationChecks)
  }

  /** Confirma e executa a checagem "Avançar" final que estava esperando o checkbox marcado. */
  async function handleConfirmFinalSubmit() {
    if (!automationRunId) return
    const lastCheck = automationChecks[automationChecks.length - 1]
    setAutomationRunning(true)
    try {
      updateAutomationCheck(lastCheck.id, { status: "running", pendingConfirmation: false })
      ensureGroupOpen(lastCheck)
      const res = await runAutomationCheck({ runId: automationRunId, checkId: lastCheck.id, confirmFinalSubmit: true })
      if (!res.success) {
        updateAutomationCheck(lastCheck.id, { status: "failed", resultReason: res.error })
        setAutomationAborted(true)
        toast.error(res.error || "Falha ao confirmar a inscrição")
        await finalizeFichaAutomationRun({ runId: automationRunId, reason: "error" })
      } else {
        updateAutomationCheck(lastCheck.id, { status: "success" })
        toast.success("Inscrição confirmada com sucesso")
        await finalizeFichaAutomationRun({ runId: automationRunId, reason: "completed" })
      }
      setAutomationRunId(null)
    } finally {
      setAutomationRunning(false)
    }
  }

  const successCount = checks.filter((c) => c.status === "success").length
  const failedCount = checks.filter((c) => c.status === "failed").length
  const pendingCount = checks.filter((c) => c.status === "pending").length
  const warningsCount = checks.reduce((acc, c) => acc + (c.warnings?.length ?? 0), 0)

  const autoSuccessCount = automationChecks.filter((c) => c.status === "success").length
  const autoFailedCount = automationChecks.filter((c) => c.status === "failed").length
  const autoPendingCount = automationChecks.filter((c) => c.status === "pending").length
  const autoSkippedCount = automationChecks.filter((c) => c.status === "skipped").length

  const ruleChecksAll = automationChecks.map((c) => c.ruleCheck).filter((r): r is RuleCheck => !!r)
  const ruleChecksPassed = ruleChecksAll.filter((c) => c.passed).length
  const ruleChecksFailed = ruleChecksAll.filter((c) => !c.passed).length

  // Agrupa as checagens por passo (etapa+passo), na ordem em que aparecem no plano.
  const passoGroups: { key: string; etapaNome: string; passoNome: string; items: AutomationCheckItem[] }[] = []
  for (const item of automationChecks) {
    const key = `${item.etapaIndex}-${item.passoIndex}`
    const last = passoGroups[passoGroups.length - 1]
    if (last?.key === key) last.items.push(item)
    else passoGroups.push({ key, etapaNome: item.etapaNome, passoNome: item.passoNome, items: [item] })
  }

  const statusChartData = [
    { name: "Sucesso", value: autoSuccessCount },
    { name: "Falha", value: autoFailedCount },
    { name: "Pendente", value: autoPendingCount },
    { name: "Ignorado", value: autoSkippedCount },
  ].filter((d) => d.value > 0)

  const passoChartData = passoGroups.map((g) => ({
    name: `${g.etapaNome} · ${g.passoNome}`,
    concluidas: g.items.filter((i) => i.status === "success").length,
    falhas: g.items.filter((i) => i.status === "failed").length,
  }))

  return (
    <div className="p-6 space-y-4">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <FlaskConical className="h-5 w-5" /> Teste de Ficha PS
        </h1>
        <p className="text-sm text-muted-foreground">
          Executa uma bateria de testes automáticos na ficha de um processo seletivo (conectividade da página pública,
          autenticação, descoberta de etapas e leitura completa de cada etapa) e devolve um relatório detalhado do que
          passou, do que falhou e do que ficou pendente. A execução para imediatamente no primeiro erro crítico, seja
          aqui ou do lado do PS.
        </p>
      </div>

      <Card>
        <CardContent className="pt-6">
          <form onSubmit={handleRunTests} className="space-y-4">
            <Field>
              <FieldLabel htmlFor="tokenPs">Token PS</FieldLabel>
              <PasswordInput id="tokenPs" value={tokenPs} onChange={setTokenPs} placeholder="Copiado do localStorage do portal admin" />
            </Field>

            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <Field>
                <FieldLabel htmlFor="idPs">ID do Processo Seletivo</FieldLabel>
                <Input id="idPs" value={idPs} onChange={(e) => setIdPs(e.target.value)} placeholder="Ex: 5537" />
              </Field>
              <Field>
                <FieldLabel htmlFor="crmDomain">Link do CRM (opcional)</FieldLabel>
                <Input id="crmDomain" value={crmDomain} onChange={(e) => setCrmDomain(e.target.value)} placeholder="Ex: https://crmtoledo.apprubeus.com.br/" />
              </Field>
            </div>

            <Field>
              <FieldLabel htmlFor="pageUrl">Link da página (ficha pública)</FieldLabel>
              <Input id="pageUrl" value={pageUrl} onChange={(e) => setPageUrl(e.target.value)} placeholder="Ex: https://portal.apprbs.com.br/senai-exemplo?idPs=17869&curso=2000810" />
            </Field>

            <div className="flex justify-center">
              <Button type="submit" disabled={running}>
                {running && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
                Executar testes de estrutura
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      {checks.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-sm flex flex-wrap items-center gap-2">
              Relatório de estrutura
              <Badge variant="success">{successCount} sucesso</Badge>
              {failedCount > 0 && <Badge variant="destructive">{failedCount} falha</Badge>}
              {pendingCount > 0 && <Badge variant="outline">{pendingCount} pendente</Badge>}
              {warningsCount > 0 && <Badge variant="secondary">{warningsCount} aviso(s)</Badge>}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {aborted && (
              <div className="mb-4 flex items-start gap-2 rounded-md border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">
                <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />
                <span>Execução interrompida no primeiro erro crítico — os testes restantes não foram executados e ficam marcados como &quot;Pendente&quot;.</span>
              </div>
            )}

            <Accordion>
              {checks.map((c) => {
                const errorKind = c.error ? guessErrorKind(c.error) : undefined
                return (
                  <AccordionItem key={c.id} value={c.id}>
                    <AccordionTrigger className="gap-1.5">
                      <span className="flex flex-1 flex-wrap items-center gap-1.5">
                        <StatusIcon status={c.status} />
                        <span>{c.label}</span>
                        {c.durationMs !== undefined && <span className="text-xs text-muted-foreground">({c.durationMs}ms)</span>}
                        {c.status === "pending" && <span className="text-xs text-muted-foreground">— não executado</span>}
                      </span>
                    </AccordionTrigger>
                    <AccordionContent>
                      <div className="space-y-2 text-sm">
                        {c.status === "success" && c.message && <p className="text-muted-foreground">{c.message}</p>}
                        {c.status === "failed" && c.error && (
                          <div className="flex flex-wrap items-center gap-2">
                            {errorKind && <Badge variant={ERROR_KIND_BADGE_VARIANT[errorKind]}>{ERROR_KIND_LABELS[errorKind]}</Badge>}
                            <span className="text-destructive">{c.error}</span>
                          </div>
                        )}
                        {c.status === "pending" && <p className="text-muted-foreground">Não executado — a execução parou em um teste anterior.</p>}
                        {c.warnings && c.warnings.length > 0 && (
                          <div className="space-y-1">
                            <p className="text-xs font-medium text-muted-foreground">Avisos:</p>
                            <ul className="list-disc pl-5 text-xs text-muted-foreground space-y-0.5">
                              {c.warnings.map((w, i) => (
                                <li key={i}>{w}</li>
                              ))}
                            </ul>
                          </div>
                        )}
                      </div>
                    </AccordionContent>
                  </AccordionItem>
                )
              })}
            </Accordion>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-sm flex items-center gap-2">
            <MousePointerClick className="h-4 w-4" /> Preenchimento automático (navegador real)
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Analisa toda a estrutura da ficha (campos, validações, obrigatoriedade, lógica condicional) e monta o
            plano de testes completo ANTES de preencher qualquer coisa — você vê tudo que vai ser testado assim que
            o plano fica pronto. Abre uma janela de navegador de verdade, visível, e preenche/testa uma checagem por
            vez, em tempo real: valor válido por campo, formatos propositalmente inválidos (CPF/e-mail/telefone/
            data/CEP) esperando bloqueio, campos obrigatórios vazios esperando bloqueio, e campos condicionais (ex:
            um checkbox que revela outros campos) — nunca ignorados, sempre revelados e testados também. Requer o{" "}
            <strong>Link da página</strong> preenchido acima.
          </p>

          <div className="flex items-start gap-2 rounded-md border border-amber-500/30 bg-amber-500/5 p-3 text-sm">
            <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0 text-amber-600" />
            <div className="space-y-2">
              <p>
                O último passo da última etapa pode gravar uma inscrição real no TOTVS. Sem marcar a confirmação
                abaixo, a automação preenche e testa tudo e <strong>para exatamente antes</strong> desse clique
                final, esperando sua confirmação explícita.
              </p>
              <div className="flex items-center gap-2">
                <Checkbox id="confirmFinalSubmit" checked={confirmFinalSubmit} onCheckedChange={(v) => setConfirmFinalSubmit(v === true)} />
                <Label htmlFor="confirmFinalSubmit">Confirmar inscrição real (envio final)</Label>
              </div>
            </div>
          </div>

          <div className="flex justify-center gap-2 flex-wrap">
            {!automationPaused && (
              <Button onClick={handleStartAutomation} disabled={automationRunning}>
                {automationRunning && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
                Executar preenchimento automático
              </Button>
            )}
            {automationRunning && !automationPaused && (
              <Button onClick={handlePauseAutomation} variant="outline">
                <Pause className="h-4 w-4 mr-2" /> Pausar
              </Button>
            )}
            {automationPaused && (
              <Button onClick={handleResumeAutomation} disabled={automationRunning}>
                <Play className="h-4 w-4 mr-2" /> Retomar
              </Button>
            )}
            {(automationRunning || automationPaused) && (
              <Button onClick={handleStopAutomation} variant="destructive">
                <Square className="h-4 w-4 mr-2" /> Parar
              </Button>
            )}
            {automationRunId && (
              <Button onClick={handleConfirmFinalSubmit} disabled={automationRunning || !confirmFinalSubmit} variant="secondary">
                {automationRunning && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
                Confirmar e concluir
              </Button>
            )}
          </div>

          {automationChecks.length > 0 && (
            <div className="space-y-4 pt-2">
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant="success">{autoSuccessCount} sucesso</Badge>
                {autoFailedCount > 0 && <Badge variant="destructive">{autoFailedCount} falha</Badge>}
                {autoPendingCount > 0 && <Badge variant="outline">{autoPendingCount} pendente</Badge>}
                {autoSkippedCount > 0 && <Badge variant="secondary">{autoSkippedCount} ignorado(s)</Badge>}
                {ruleChecksAll.length > 0 && <Badge variant="success">{ruleChecksPassed} regra(s) validada(s)</Badge>}
                {ruleChecksFailed > 0 && <Badge variant="destructive">{ruleChecksFailed} regra(s) com achado</Badge>}
              </div>

              {automationPaused && (
                <div className="flex items-start gap-2 rounded-md border border-amber-500/30 bg-amber-500/5 p-3 text-sm">
                  <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0 text-amber-600" />
                  <span>Automação pausada — o navegador continua aberto com o que já foi preenchido. Clique em &quot;Retomar&quot; para continuar de onde parou.</span>
                </div>
              )}

              {automationAborted && (
                <div className="flex items-start gap-2 rounded-md border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">
                  <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />
                  <span>Execução interrompida — as checagens restantes não foram executadas e ficam marcadas como &quot;Pendente&quot;.</span>
                </div>
              )}

              {passoChartData.length > 1 && (
                <div>
                  <p className="text-xs font-medium text-muted-foreground mb-1">Checagens concluídas por passo</p>
                  <MultiTypeChart
                    data={passoChartData}
                    nameKey="name"
                    series={[
                      { key: "concluidas", name: "Concluídas", color: "var(--chart-2)" },
                      { key: "falhas", name: "Falhas", color: "var(--chart-4)" },
                    ]}
                    kind="bar-h"
                    height={Math.max(160, passoChartData.length * 40)}
                  />
                </div>
              )}

              {statusChartData.length > 0 && (
                <div>
                  <p className="text-xs font-medium text-muted-foreground mb-1">Status das checagens</p>
                  <MultiTypeChart data={statusChartData} nameKey="name" series={[{ key: "value", name: "Checagens" }]} kind="donut" height={200} />
                </div>
              )}

              <Accordion value={openGroups} onValueChange={setOpenGroups}>
                {passoGroups.map((group) => {
                  const groupSuccess = group.items.filter((i) => i.status === "success").length
                  const groupFailed = group.items.filter((i) => i.status === "failed").length
                  const groupRunning = group.items.some((i) => i.status === "running")
                  return (
                    <AccordionItem key={group.key} value={group.key}>
                      <AccordionTrigger className="gap-1.5">
                        <span className="flex flex-1 flex-wrap items-center gap-1.5">
                          {groupRunning ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : groupFailed > 0 ? <AlertCircle className="h-3.5 w-3.5 text-destructive" /> : <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />}
                          <span>
                            {group.etapaNome} · {group.passoNome}
                          </span>
                          <span className="text-xs text-muted-foreground">
                            ({groupSuccess}/{group.items.length})
                          </span>
                        </span>
                      </AccordionTrigger>
                      <AccordionContent>
                        <ul className="space-y-1.5 text-sm">
                          {group.items.map((c) => (
                            <li key={c.id} className="flex items-start gap-1.5">
                              <StatusIcon status={c.status} />
                              <div className="min-w-0">
                                <span>
                                  <span className="font-medium">{CHECK_KIND_LABELS[c.kind]}</span>
                                  {c.label !== CHECK_KIND_LABELS[c.kind] && <span className="text-muted-foreground"> — {c.label}</span>}
                                  {c.invalidInput && <span className="text-muted-foreground"> ({c.invalidInput})</span>}
                                  {c.pendingConfirmation && <Badge variant="outline" className="ml-2">aguardando confirmação</Badge>}
                                </span>
                                {c.status === "success" && c.resultValue !== undefined && <p className="text-xs text-muted-foreground">Valor: {c.resultValue}</p>}
                                {(c.status === "failed" || c.status === "skipped") && c.resultReason && <p className="text-xs text-muted-foreground">{c.resultReason}</p>}
                                {c.ruleCheck && (
                                  <p className="text-xs text-muted-foreground">
                                    {c.ruleCheck.passed ? "Bloqueado corretamente" : `NÃO bloqueado (${c.ruleCheck.detail ?? "aceitou o valor"})`}
                                  </p>
                                )}
                                {c.revealOutcome && (
                                  <p className="text-xs text-muted-foreground">
                                    {c.revealOutcome.revealed.length} campo(s) revelado(s)
                                    {c.revealOutcome.stillHidden.length > 0 && `, ${c.revealOutcome.stillHidden.length} ainda oculto(s)`}
                                  </p>
                                )}
                              </div>
                            </li>
                          ))}
                        </ul>
                      </AccordionContent>
                    </AccordionItem>
                  )
                })}
              </Accordion>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
