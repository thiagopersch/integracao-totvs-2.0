"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Loader2, PlugZap, Sparkles } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Checkbox } from "@/components/ui/checkbox"
import { Field, FieldDescription, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { PasswordInput } from "@/components/ui/password-input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { saveAiSettings, testAiSettings } from "@/actions/integrations/ai-settings"
import { AI_DEFAULT_MODEL, AI_MODEL_SUGGESTIONS, AI_PROVIDER_LABELS, type AiProviderId } from "@/lib/ai/types"

interface AiSettingsClientProps {
  initialSettings: {
    provider: AiProviderId
    model: string
    enabled: boolean
    instructions: string | null
    hasApiKey: boolean
  } | null
}

const PROVIDERS: AiProviderId[] = ["ANTHROPIC", "OPENAI", "GEMINI"]

export function AiSettingsClient({ initialSettings }: AiSettingsClientProps) {
  const router = useRouter()
  const [provider, setProvider] = useState<AiProviderId>(initialSettings?.provider ?? "ANTHROPIC")
  const [model, setModel] = useState(initialSettings?.model ?? AI_DEFAULT_MODEL.ANTHROPIC)
  const [apiKey, setApiKey] = useState("")
  const [enabled, setEnabled] = useState(initialSettings?.enabled ?? true)
  const [instructions, setInstructions] = useState(initialSettings?.instructions ?? "")
  const [saving, setSaving] = useState(false)
  const [testing, setTesting] = useState(false)

  const keyStoredForProvider = !!initialSettings?.hasApiKey && initialSettings.provider === provider

  function changeProvider(next: AiProviderId) {
    setProvider(next)
    if (AI_MODEL_SUGGESTIONS[provider].includes(model) || !model) setModel(AI_DEFAULT_MODEL[next])
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    const result = await saveAiSettings({ provider, model, apiKey, enabled, instructions })
    setSaving(false)
    if (result.success) {
      toast.success("Configuração de IA salva")
      setApiKey("")
      router.refresh()
    } else {
      toast.error(result.error || "Erro ao salvar")
    }
  }

  async function handleTest() {
    setTesting(true)
    const result = await testAiSettings()
    setTesting(false)
    if (result.success) toast.success(result.message)
    else toast.error(result.error)
  }

  return (
    <div className="space-y-4 p-4 md:p-6">
      <div>
        <h1 className="flex items-center gap-2 text-2xl font-bold">
          <Sparkles className="h-5 w-5" /> Assistente IA
        </h1>
        <p className="text-sm text-muted-foreground">
          Provedor de IA usado pelo botão &quot;Assistente IA&quot; da tela de Demandas para lançar demandas a partir de texto livre.
        </p>
      </div>

      <Card>
        <CardContent className="pt-6">
          <form onSubmit={handleSave} className="space-y-4">
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <Field>
                <FieldLabel>Provedor</FieldLabel>
                <Select
                  items={PROVIDERS.map((p) => ({ value: p, label: AI_PROVIDER_LABELS[p] }))}
                  value={provider}
                  onValueChange={(v) => v && changeProvider(v as AiProviderId)}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {PROVIDERS.map((p) => (
                      <SelectItem key={p} value={p}>
                        {AI_PROVIDER_LABELS[p]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
              <Field>
                <FieldLabel htmlFor="ai-model">Modelo</FieldLabel>
                <Input id="ai-model" value={model} onChange={(e) => setModel(e.target.value)} list="ai-model-suggestions" />
                <datalist id="ai-model-suggestions">
                  {AI_MODEL_SUGGESTIONS[provider].map((m) => (
                    <option key={m} value={m} />
                  ))}
                </datalist>
                <FieldDescription>Sugestões: {AI_MODEL_SUGGESTIONS[provider].join(", ")}</FieldDescription>
              </Field>
            </div>

            <Field>
              <FieldLabel htmlFor="ai-key">{keyStoredForProvider ? "Nova chave de API" : "Chave de API"}</FieldLabel>
              <PasswordInput
                id="ai-key"
                value={apiKey}
                onChange={setApiKey}
                placeholder={keyStoredForProvider ? "Deixe em branco para manter a chave atual" : "Cole a chave de API do provedor"}
              />
              <FieldDescription>Armazenada criptografada; nunca é exibida novamente.</FieldDescription>
            </Field>

            <Field>
              <FieldLabel htmlFor="ai-instructions">Instruções adicionais (opcional)</FieldLabel>
              <Textarea
                id="ai-instructions"
                rows={5}
                value={instructions}
                onChange={(e) => setInstructions(e.target.value)}
                placeholder={
                  "Ex.: Quando não informado, use o tipo de demanda \"Suporte\" e o status \"Concluída\".\nO setor padrão do cliente X é \"Secretaria\"."
                }
              />
              <FieldDescription>Regras e valores padrão que a IA deve seguir ao montar as demandas.</FieldDescription>
            </Field>

            <div className="flex items-center gap-2">
              <Checkbox id="ai-enabled" checked={enabled} onCheckedChange={(v) => setEnabled(v === true)} />
              <Label htmlFor="ai-enabled">Assistente ativo</Label>
            </div>

            <div className="flex gap-2">
              <Button type="submit" disabled={saving}>
                {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Salvar
              </Button>
              <Button type="button" variant="outline" onClick={handleTest} disabled={testing || !initialSettings}>
                {testing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <PlugZap className="mr-2 h-4 w-4" />}
                Testar conexão
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
