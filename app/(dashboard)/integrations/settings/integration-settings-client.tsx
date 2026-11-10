"use client"

import { useState, useTransition } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { RotateCcw, Save, Settings } from "lucide-react"
import { toast } from "@/lib/toast"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { resetIntegrationSettings, saveIntegrationSettings } from "@/actions/integrations/integration-settings"
import { INTEGRATION_LABELS, INTEGRATION_LIMITS, RETRYABLE_INTEGRATIONS } from "@/lib/integration-config-shared"
import type { IntegrationSettingsRow } from "@/services/integration-settings.service"

const seconds = (ms: number) => String(Math.round(ms / 100) / 10)

export function IntegrationSettingsClient({ rows }: { rows: IntegrationSettingsRow[] }) {
  return (
    <div className="space-y-4 p-4 md:p-6">
      <div>
        <h1 className="flex items-center gap-2 text-2xl font-bold">
          <Settings className="h-5 w-5" /> Configurações de integrações
        </h1>
        <p className="text-sm text-muted-foreground">
          Tempo limite (e novas tentativas, no TOTVS RM) de cada integração externa desta organização. O tempo da IA fica em{" "}
          <Link href="/integrations/ai" className="underline">
            Assistente IA
          </Link>
          .
        </p>
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        {rows.map((row) => (
          <IntegrationCard key={row.integration} row={row} />
        ))}
      </div>
    </div>
  )
}

function IntegrationCard({ row }: { row: IntegrationSettingsRow }) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [timeoutSeconds, setTimeoutSeconds] = useState(seconds(row.timeoutMs))
  const [maxRetries, setMaxRetries] = useState(String(row.maxRetries))
  const [retryDelaySeconds, setRetryDelaySeconds] = useState(seconds(row.retryDelayMs))
  const retryable = RETRYABLE_INTEGRATIONS.includes(row.integration)
  const info = INTEGRATION_LABELS[row.integration]
  const id = (field: string) => `${row.integration}-${field}`

  function save(e: React.FormEvent) {
    e.preventDefault()
    startTransition(async () => {
      const result = await saveIntegrationSettings({ integration: row.integration, timeoutSeconds, maxRetries, retryDelaySeconds })
      if (result.success) {
        toast.success(`${info.label}: configuração salva`)
        router.refresh()
      } else toast.error(result.error)
    })
  }

  function reset() {
    startTransition(async () => {
      const result = await resetIntegrationSettings(row.integration)
      if (result.success) {
        toast.success(`${info.label}: padrões restaurados`)
        setTimeoutSeconds(seconds(row.defaults.timeoutMs))
        setMaxRetries(String(row.defaults.maxRetries))
        setRetryDelaySeconds(seconds(row.defaults.retryDelayMs))
        router.refresh()
      } else toast.error(result.error)
    })
  }

  return (
    <Card>
      <CardContent className="pt-6">
        <form onSubmit={save} className="space-y-4">
          <div className="flex items-start justify-between gap-2">
            <div>
              <h2 className="font-semibold">{info.label}</h2>
              <p className="text-sm text-muted-foreground">{info.description}</p>
            </div>
            <Badge variant={row.customized ? "default" : "secondary"}>{row.customized ? "Personalizado" : "Padrão"}</Badge>
          </div>
          <div className="grid gap-3 sm:grid-cols-3">
            <div className="space-y-1">
              <Label htmlFor={id("timeout")}>Tempo limite (s)</Label>
              <Input
                id={id("timeout")}
                type="number"
                inputMode="decimal"
                min={INTEGRATION_LIMITS.timeoutMs.min / 1000}
                max={INTEGRATION_LIMITS.timeoutMs.max / 1000}
                step={0.5}
                value={timeoutSeconds}
                onChange={(e) => setTimeoutSeconds(e.target.value)}
              />
            </div>
            {retryable && (
              <>
                <div className="space-y-1">
                  <Label htmlFor={id("retries")}>Tentativas</Label>
                  <Input
                    id={id("retries")}
                    type="number"
                    inputMode="numeric"
                    min={1}
                    max={INTEGRATION_LIMITS.maxRetries.max}
                    value={maxRetries}
                    onChange={(e) => setMaxRetries(e.target.value)}
                  />
                </div>
                <div className="space-y-1">
                  <Label htmlFor={id("delay")}>Intervalo (s)</Label>
                  <Input
                    id={id("delay")}
                    type="number"
                    inputMode="decimal"
                    min={0}
                    max={INTEGRATION_LIMITS.retryDelayMs.max / 1000}
                    step={0.5}
                    value={retryDelaySeconds}
                    onChange={(e) => setRetryDelaySeconds(e.target.value)}
                  />
                </div>
              </>
            )}
          </div>
          <p className="text-xs text-muted-foreground">
            Padrão: {seconds(row.defaults.timeoutMs)} s{retryable ? `, ${row.defaults.maxRetries} tentativas a cada ${seconds(row.defaults.retryDelayMs)} s` : ""}.
          </p>
          <div className="flex justify-end gap-2">
            {row.customized && (
              <Button type="button" variant="outline" onClick={reset} disabled={pending}>
                <RotateCcw className="h-4 w-4" /> Restaurar padrão
              </Button>
            )}
            <Button type="submit" disabled={pending}>
              <Save className="h-4 w-4" /> Salvar
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  )
}
