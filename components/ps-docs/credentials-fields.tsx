"use client"

import { PasswordInput } from "@/components/ui/password-input"
import { Field, FieldLabel } from "@/components/ui/field"
import { CredentialsHelp } from "@/components/ps-docs/credentials-help"
import { missingCookieNames } from "@/lib/ps-docs/credential"

/** Single `Cookie` input for the portal admin session (controlled version, used outside react-hook-form). */
export function CredentialsFields({ value, onChange }: { value: string; onChange: (next: string) => void }) {
  const missing = value.trim() ? missingCookieNames(value) : []

  return (
    <div className="space-y-2 rounded-md border p-4">
      <CredentialsHelp />
      <Field>
        <FieldLabel htmlFor="cookieHeader">Cookie</FieldLabel>
        <PasswordInput
          id="cookieHeader"
          value={value}
          onChange={onChange}
          placeholder="branch=master; client_id=...; inscricoes_session=...; XSRF-TOKEN=..."
          aria-invalid={missing.length > 0}
        />
        {missing.length > 0 && <p className="text-sm text-destructive">Faltando no cookie: {missing.join(", ")}</p>}
      </Field>
    </div>
  )
}
