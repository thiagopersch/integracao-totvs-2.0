"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Checkbox } from "@/components/ui/checkbox"
import { Field, FieldLabel } from "@/components/ui/field"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { CodeEditor } from "@/components/shared/code-editor"
import { Loader2, Plug } from "lucide-react"
import { toast } from "sonner"
import { testTpiLogin } from "@/actions/integrations/tpi"

interface TpiFormState {
  portalLink: string
  login: string
  senha: string
  tipoIdentificacao: string
  codcoligada: string
  codfilial: string
  idps: string
  useSsl: boolean
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
}

export default function TpiIntegrationPage() {
  const [form, setForm] = useState<TpiFormState>(initialForm)
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<Awaited<ReturnType<typeof testTpiLogin>> | null>(null)

  function update<K extends keyof TpiFormState>(key: K, value: TpiFormState[K]) {
    setForm((prev) => ({ ...prev, [key]: value }))
  }

  const trimmedLink = form.portalLink.trim().replace(/\/+$/, "")
  const endpointPreview = trimmedLink ? `${trimmedLink}/RM/API/TOTVSProcessoSeletivo/Login` : ""

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.portalLink || !form.login || !form.senha || !form.tipoIdentificacao || !form.codcoligada || !form.codfilial || !form.idps) {
      toast.error("Preencha todos os campos obrigatórios")
      return
    }
    setLoading(true)
    setResult(null)
    try {
      const res = await testTpiLogin(form)
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

  const loginOk = result?.success && result.data?.data?.LOGADOSUCESSO === true

  return (
    <div className="p-6 space-y-4">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <Plug className="h-5 w-5" /> TPI TOTVS — Pagamento Instantâneo
        </h1>
        <p className="text-sm text-muted-foreground">
          Testa a conexão com o portal do aluno do cliente (login TOTVS Processo Seletivo) antes de configurar a integração.
        </p>
      </div>

      <Card>
        <CardContent className="pt-6">
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

            <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
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

            <div className="flex items-center gap-2">
              <Checkbox id="useSsl" checked={form.useSsl} onCheckedChange={(v) => update("useSsl", v === true)} />
              <Label htmlFor="useSsl">Usar certificado SSL</Label>
            </div>

            <Field>
              <FieldLabel>Endpoint</FieldLabel>
              <Input readOnly value={endpointPreview} className="font-mono text-xs" placeholder="Informe o link do portal para ver o endpoint" />
            </Field>

            <Button type="submit" disabled={loading}>
              {loading && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
              Testar Conexão
            </Button>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm flex items-center justify-between">
            <span>Resposta</span>
            {result?.success && (
              <div className="flex items-center gap-2">
                {result.httpStatus !== undefined && <Badge variant="outline">HTTP {result.httpStatus}</Badge>}
                <Badge variant={loginOk ? "default" : "destructive"}>
                  {loginOk ? "Login com sucesso" : "Login sem sucesso"}
                </Badge>
              </div>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {!result ? (
            <p className="text-muted-foreground text-sm">Teste a conexão para ver a resposta da API.</p>
          ) : result.success ? (
            <CodeEditor value={JSON.stringify(result.data, null, 2)} language="json" readOnly minHeight="240px" />
          ) : (
            <CodeEditor value={result.error ?? ""} language="json" readOnly minHeight="120px" />
          )}
        </CardContent>
      </Card>
    </div>
  )
}
