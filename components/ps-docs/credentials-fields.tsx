"use client"

import { Input } from "@/components/ui/input"
import { PasswordInput } from "@/components/ui/password-input"
import { Field, FieldLabel } from "@/components/ui/field"
import type { PsCredentials } from "@/lib/ps-docs/credential"

/** Four cookie inputs for the portal admin session (controlled version, used outside react-hook-form). */
export function CredentialsFields({ value, onChange }: { value: PsCredentials; onChange: (next: PsCredentials) => void }) {
  const set = (key: keyof PsCredentials, v: string) => onChange({ ...value, [key]: v })

  return (
    <div className="space-y-2 rounded-md border p-4">
      <div>
        <p className="text-sm font-medium">Cookies da sessão do portal admin</p>
        <p className="text-xs text-muted-foreground">
          Faça login em admin.portal.apprbs.com.br → DevTools (F12) → aba Application → Storage → Cookies → https://admin.portal.apprbs.com.br. Copie a
          coluna <strong>Value</strong> de cada cookie abaixo (só o valor, sem o nome).
        </p>
      </div>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <Field>
          <FieldLabel htmlFor="cookieBranch">Branch</FieldLabel>
          <Input id="cookieBranch" value={value.branch} onChange={(e) => set("branch", e.target.value)} placeholder="master" />
        </Field>
        <Field>
          <FieldLabel htmlFor="cookieClientId">client_id</FieldLabel>
          <PasswordInput id="cookieClientId" value={value.clientId} onChange={(v) => set("clientId", v)} placeholder="Value do cookie client_id" />
        </Field>
        <Field>
          <FieldLabel htmlFor="cookieSession">inscricoes_session</FieldLabel>
          <PasswordInput id="cookieSession" value={value.session} onChange={(v) => set("session", v)} placeholder="Value do cookie inscricoes_session" />
        </Field>
        <Field>
          <FieldLabel htmlFor="cookieXsrf">XSRF-TOKEN</FieldLabel>
          <PasswordInput id="cookieXsrf" value={value.xsrf} onChange={(v) => set("xsrf", v)} placeholder="Value do cookie XSRF-TOKEN" />
        </Field>
      </div>
    </div>
  )
}
