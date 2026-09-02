"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { PasswordInput } from "@/components/ui/password-input"
import { Label } from "@/components/ui/label"
import { Checkbox } from "@/components/ui/checkbox"
import { Field, FieldLabel } from "@/components/ui/field"
import { Card, CardContent } from "@/components/ui/card"
import { Loader2, Mail } from "lucide-react"
import { toast } from "sonner"
import { saveEmailSettings } from "@/actions/integrations/email-settings"

type EmailSettings = {
  id: string
  host: string
  port: number
  user: string
  from: string
  enabled: boolean
} | null

interface EmailSettingsClientProps {
  initialSettings: EmailSettings
}

interface EmailFormState {
  host: string
  port: string
  user: string
  password: string
  from: string
  enabled: boolean
}

export function EmailSettingsClient({ initialSettings }: EmailSettingsClientProps) {
  const [form, setForm] = useState<EmailFormState>({
    host: initialSettings?.host || "",
    port: initialSettings ? String(initialSettings.port) : "587",
    user: initialSettings?.user || "",
    password: "",
    from: initialSettings?.from || "",
    enabled: initialSettings?.enabled ?? true,
  })
  const [loading, setLoading] = useState(false)

  function update<K extends keyof EmailFormState>(key: K, value: EmailFormState[K]) {
    setForm((prev) => ({ ...prev, [key]: value }))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.host || !form.port || !form.user || !form.from || (!initialSettings && !form.password)) {
      toast.error("Preencha todos os campos obrigatórios")
      return
    }

    setLoading(true)
    const formData = new FormData()
    formData.append("host", form.host)
    formData.append("port", form.port)
    formData.append("user", form.user)
    formData.append("password", form.password)
    formData.append("from", form.from)
    formData.append("enabled", String(form.enabled))

    const result = await saveEmailSettings(formData)
    if (result.success) {
      toast.success("Configuração de e-mail salva")
      setForm((prev) => ({ ...prev, password: "" }))
    } else {
      toast.error(result.error || "Erro ao salvar")
    }
    setLoading(false)
  }

  return (
    <div className="p-6 space-y-4">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <Mail className="h-5 w-5" /> Integração de E-mail
        </h1>
        <p className="text-sm text-muted-foreground">
          Configure o servidor SMTP usado para enviar notificações por e-mail. Substitui a antiga configuração fixa via .env.
        </p>
      </div>

      <Card>
        <CardContent className="pt-6">
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
              <Field className="md:col-span-2">
                <FieldLabel htmlFor="host">Servidor SMTP</FieldLabel>
                <Input id="host" value={form.host} onChange={(e) => update("host", e.target.value)} placeholder="smtp.exemplo.com" />
              </Field>
              <Field>
                <FieldLabel htmlFor="port">Porta</FieldLabel>
                <Input id="port" type="number" value={form.port} onChange={(e) => update("port", e.target.value)} placeholder="587" />
              </Field>
            </div>

            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <Field>
                <FieldLabel htmlFor="user">Usuário</FieldLabel>
                <Input id="user" value={form.user} onChange={(e) => update("user", e.target.value)} placeholder="usuario@exemplo.com" />
              </Field>
              <Field>
                <FieldLabel htmlFor="password">{initialSettings ? "Nova senha" : "Senha"}</FieldLabel>
                <PasswordInput
                  id="password"
                  value={form.password}
                  onChange={(value) => update("password", value)}
                  placeholder={initialSettings ? "Deixe em branco para manter a senha atual" : "Senha"}
                />
              </Field>
            </div>

            <Field>
              <FieldLabel htmlFor="from">Remetente</FieldLabel>
              <Input
                id="from"
                value={form.from}
                onChange={(e) => update("from", e.target.value)}
                placeholder='"Integração TOTVS" <notificacoes@exemplo.com>'
              />
            </Field>

            <div className="flex items-center gap-2">
              <Checkbox id="enabled" checked={form.enabled} onCheckedChange={(v) => update("enabled", v === true)} />
              <Label htmlFor="enabled">Envio de e-mail ativo</Label>
            </div>

            <Button type="submit" disabled={loading}>
              {loading && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
              Salvar
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
