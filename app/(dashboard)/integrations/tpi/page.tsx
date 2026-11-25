"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Checkbox } from "@/components/ui/checkbox"
import { Field, FieldLabel } from "@/components/ui/field"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { CodeEditor } from "@/components/shared/code-editor"
import { CurrencyInput } from "@/components/ui/currency-input"
import { CollapsibleCardHeader } from "@/components/shared/collapsible-card-header"
import { TpiPixResult } from "@/components/integrations/tpi-pix-result"
import { Loader2, Plug, QrCode } from "lucide-react"
import { toast } from "@/lib/toast"
import { testTpiLogin, testTpiPix } from "@/actions/integrations/tpi"

interface TpiFormState {
  portalLink: string
  login: string
  senha: string
  tipoIdentificacao: string
  codcoligada: string
  codfilial: string
  idps: string
  useSsl: boolean
  idBoleto: string
  valor: number | null
}

type PixResult = Awaited<ReturnType<typeof testTpiPix>>

/** Masks the login TOKEN and truncates the base64 QR image so the raw JSON stays readable. */
function sanitizeForView(value: unknown): unknown {
  return JSON.parse(
    JSON.stringify(value, (key, v) => {
      if (key === "TOKEN" && typeof v === "string") return v.length > 12 ? `${v.slice(0, 6)}…${v.slice(-6)}` : "***"
      if (key === "QrCode" && typeof v === "string" && v.length > 80) return `${v.slice(0, 60)}… (${v.length} caracteres)`
      return v
    }),
  )
}

const initialForm: TpiFormState = {
  portalLink: "",
  login: "",
  senha: "",
  tipoIdentificacao: "0",
  codcoligada: "1",
  codfilial: "1",
  idps: "",
  useSsl: true,
  idBoleto: "",
  valor: null,
}

export default function TpiIntegrationPage() {
  const [form, setForm] = useState<TpiFormState>(initialForm)
  const [loading, setLoading] = useState(false)
  const [pixLoading, setPixLoading] = useState(false)
  const [result, setResult] = useState<Awaited<ReturnType<typeof testTpiLogin>> | null>(null)
  const [pixResult, setPixResult] = useState<PixResult | null>(null)
  const [sections, setSections] = useState({ form: true, login: true, pix: true, json: false })

  function toggle(key: keyof typeof sections) {
    setSections((prev) => ({ ...prev, [key]: !prev[key] }))
  }

  function update<K extends keyof TpiFormState>(key: K, value: TpiFormState[K]) {
    setForm((prev) => ({ ...prev, [key]: value }))
  }

  const trimmedLink = form.portalLink.trim().replace(/\/+$/, "")
  const endpointPreview = trimmedLink ? `${trimmedLink}/RM/API/TOTVSProcessoSeletivo/Login` : ""
  const pixEndpointPreview = trimmedLink ? `${trimmedLink}/RM/API/TOTVSProcessoSeletivo/Financeiro/v1/DadosPagamentoPix` : ""

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.portalLink || !form.login || !form.senha || !form.tipoIdentificacao || !form.codcoligada || !form.codfilial || !form.idps) {
      toast.error("Preencha todos os campos obrigatórios")
      return
    }
    setLoading(true)
    setResult(null)
    setPixResult(null)
    try {
      const { portalLink, login, senha, tipoIdentificacao, codcoligada, codfilial, idps, useSsl } = form
      const res = await testTpiLogin({ portalLink, login, senha, tipoIdentificacao, codcoligada, codfilial, idps, useSsl })
      setResult(res)
      if (!res.success) {
        toast.error(res.error || "Erro ao testar conexão")
      } else if (res.data?.data?.LOGADOSUCESSO) {
        toast.success("Login realizado com sucesso — token recebido")
      } else {
        toast.error("A API respondeu, mas o login não teve sucesso")
      }
    } finally {
      setLoading(false)
    }
  }

  async function handleGeneratePix() {
    if (!form.portalLink || !form.login || !form.senha || !form.tipoIdentificacao || !form.codcoligada || !form.codfilial || !form.idps) {
      toast.error("Preencha todos os campos obrigatórios")
      return
    }
    if (!form.idBoleto || !form.valor) {
      toast.error("Informe o ID do boleto e o valor para gerar o PIX")
      return
    }
    setPixLoading(true)
    setPixResult(null)
    setResult(null)
    try {
      const res = await testTpiPix({ ...form, valor: String(form.valor) })
      setPixResult(res)
      if (res.success && res.pix?.data?.CodReturno === 1) {
        toast.success("PIX gerado com sucesso")
      } else if (res.success) {
        toast.error(res.pix?.data?.Mensagem || "A API respondeu, mas o PIX não foi gerado")
      } else {
        toast.error(res.step === "login" ? `Login: ${res.error ?? "falhou"}` : `PIX: ${res.error ?? "falhou"}`)
      }
    } finally {
      setPixLoading(false)
    }
  }

  const loginOk = result?.success && result.data?.data?.LOGADOSUCESSO === true
  const pixLoginData = pixResult?.login.data?.data
  const pixLoginOk = pixLoginData?.LOGADOSUCESSO === true
  const busy = loading || pixLoading

  return (
    <div className="p-4 md:p-6 space-y-4">
      <div>
        <h1 className="text-xl md:text-2xl font-bold flex items-center gap-2">
          <Plug className="h-5 w-5 shrink-0" /> TPI TOTVS — Pagamento Instantâneo
        </h1>
        <p className="text-sm text-muted-foreground">
          Testa a conexão com o portal do aluno do cliente (login TOTVS Processo Seletivo) antes de configurar a integração.
        </p>
      </div>

      <Card>
        <CollapsibleCardHeader
          title="Dados de acesso"
          open={sections.form}
          onToggle={() => toggle("form")}
          controlsId="tpi-form"
          summary={[trimmedLink, form.login].filter(Boolean).join(" · ")}
        />
        <CardContent id="tpi-form" hidden={!sections.form}>
          <form onSubmit={handleSubmit} className="space-y-4">
            <Field>
              <FieldLabel htmlFor="portalLink">Link do portal do aluno</FieldLabel>
              <Input
                id="portalLink"
                value={form.portalLink}
                onChange={(e) => update("portalLink", e.target.value)}
                placeholder="https://meuportal.exemplo.edu.br/FrameHTML"
              />
            </Field>

            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <Field>
                <FieldLabel htmlFor="login">Login</FieldLabel>
                <Input id="login" value={form.login} onChange={(e) => update("login", e.target.value)} placeholder="CPF ou matrícula" />
              </Field>
              <Field>
                <FieldLabel htmlFor="senha">Senha</FieldLabel>
                <Input id="senha" value={form.senha} onChange={(e) => update("senha", e.target.value)} placeholder="Ex: data de nascimento" />
              </Field>
            </div>

            <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
              <Field>
                <FieldLabel htmlFor="tipoIdentificacao">Tipo de Identificação</FieldLabel>
                <Input id="tipoIdentificacao" type="number" value={form.tipoIdentificacao} onChange={(e) => update("tipoIdentificacao", e.target.value)} />
              </Field>
              <Field>
                <FieldLabel htmlFor="codcoligada">Código Coligada</FieldLabel>
                <Input id="codcoligada" type="number" value={form.codcoligada} onChange={(e) => update("codcoligada", e.target.value)} />
              </Field>
              <Field>
                <FieldLabel htmlFor="codfilial">Código Filial</FieldLabel>
                <Input id="codfilial" type="number" value={form.codfilial} onChange={(e) => update("codfilial", e.target.value)} />
              </Field>
              <Field>
                <FieldLabel htmlFor="idps">IDPS</FieldLabel>
                <Input id="idps" type="number" value={form.idps} onChange={(e) => update("idps", e.target.value)} placeholder="35" />
              </Field>
            </div>

            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <Field>
                <FieldLabel htmlFor="idBoleto">ID do Boleto</FieldLabel>
                <Input id="idBoleto" type="number" value={form.idBoleto} onChange={(e) => update("idBoleto", e.target.value)} placeholder="Necessário para gerar o PIX" />
              </Field>
              <Field>
                <FieldLabel htmlFor="valor">Valor</FieldLabel>
                <CurrencyInput id="valor" value={form.valor} onValueChange={(v) => update("valor", v)} />
              </Field>
            </div>

            <div className="flex items-center gap-2">
              <Checkbox id="useSsl" checked={form.useSsl} onCheckedChange={(v) => update("useSsl", v === true)} />
              <Label htmlFor="useSsl">Usar certificado SSL</Label>
            </div>

            <Field>
              <FieldLabel>Endpoint de login</FieldLabel>
              <Input readOnly value={endpointPreview} className="font-mono text-xs" placeholder="Informe o link do portal para ver o endpoint" />
            </Field>
            <Field>
              <FieldLabel>Endpoint do PIX</FieldLabel>
              <Input readOnly value={pixEndpointPreview} className="font-mono text-xs" placeholder="Informe o link do portal para ver o endpoint" />
            </Field>

            <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
              <Button type="submit" disabled={busy} className="w-full sm:w-auto">
                {loading && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
                Testar Conexão
              </Button>
              <Button type="button" variant="outline" disabled={busy} onClick={handleGeneratePix} className="w-full sm:w-auto">
                {pixLoading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <QrCode className="h-4 w-4 mr-2" />}
                Login + Gerar PIX
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      {pixResult ? (
        <>
          <Card>
            <CollapsibleCardHeader
              title="Login"
              open={sections.login}
              onToggle={() => toggle("login")}
              controlsId="tpi-login"
              summary={pixLoginData?.NOME}
              aside={
                <>
                  {pixResult.login.httpStatus !== undefined && <Badge variant="outline">HTTP {pixResult.login.httpStatus}</Badge>}
                  <Badge variant={pixLoginOk ? "default" : "destructive"}>{pixLoginOk ? "Login com sucesso" : "Login sem sucesso"}</Badge>
                </>
              }
            />
            <CardContent id="tpi-login" hidden={!sections.login}>
              {pixResult.login.error ? (
                <p className="text-sm text-destructive">{pixResult.login.error}</p>
              ) : (
                <dl className="grid grid-cols-1 gap-x-6 gap-y-2 text-sm sm:grid-cols-2">
                  <div className="flex flex-col gap-0.5 sm:flex-row sm:justify-between sm:gap-4">
                    <dt className="text-muted-foreground">Nome</dt>
                    <dd className="font-medium break-words sm:text-right">{pixLoginData?.NOME ?? "—"}</dd>
                  </div>
                  <div className="flex flex-col gap-0.5 sm:flex-row sm:justify-between sm:gap-4">
                    <dt className="text-muted-foreground">Cód. usuário PS</dt>
                    <dd className="font-medium sm:text-right">{pixLoginData?.CODUSUARIOPS ?? "—"}</dd>
                  </div>
                </dl>
              )}
            </CardContent>
          </Card>

          {pixResult.pix?.data && typeof pixResult.pix.data === "object" ? (
            <TpiPixResult data={pixResult.pix.data} httpStatus={pixResult.pix.httpStatus} open={sections.pix} onToggle={() => toggle("pix")} />
          ) : pixResult.step === "pix" && pixResult.error ? (
            <Card>
              <CollapsibleCardHeader title="Pagamento PIX" open={sections.pix} onToggle={() => toggle("pix")} controlsId="tpi-pix-error" />
              <CardContent id="tpi-pix-error" hidden={!sections.pix}>
                <p className="text-sm text-destructive break-words">{pixResult.error}</p>
              </CardContent>
            </Card>
          ) : null}

          <Card>
            <CollapsibleCardHeader title="JSON das respostas" open={sections.json} onToggle={() => toggle("json")} controlsId="tpi-json" />
            <CardContent id="tpi-json" hidden={!sections.json}>
              <CodeEditor
                value={JSON.stringify(sanitizeForView({ login: pixResult.login.data, pix: pixResult.pix?.data ?? pixResult.pix?.error }), null, 2)}
                language="json"
                readOnly
                minHeight="240px"
              />
            </CardContent>
          </Card>
        </>
      ) : (
        <Card>
          <CollapsibleCardHeader
            title="Resposta"
            open={sections.login}
            onToggle={() => toggle("login")}
            controlsId="tpi-response"
            aside={
              result?.success && (
                <>
                  {result.httpStatus !== undefined && <Badge variant="outline">HTTP {result.httpStatus}</Badge>}
                  <Badge variant={loginOk ? "default" : "destructive"}>{loginOk ? "Login com sucesso" : "Login sem sucesso"}</Badge>
                </>
              )
            }
          />
          <CardContent id="tpi-response" hidden={!sections.login}>
            {!result ? (
              <p className="text-muted-foreground text-sm">Teste a conexão para ver a resposta da API.</p>
            ) : result.success ? (
              <CodeEditor value={JSON.stringify(result.data, null, 2)} language="json" readOnly minHeight="240px" />
            ) : (
              <CodeEditor value={result.error ?? ""} language="json" readOnly minHeight="120px" />
            )}
          </CardContent>
        </Card>
      )}
    </div>
  )
}
