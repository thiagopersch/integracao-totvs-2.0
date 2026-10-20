"use client"

import { Textarea } from "@/components/ui/textarea"
import { Field, FieldLabel } from "@/components/ui/field"
import { COOKIE_TEXTAREA_PROPS, CredentialsHelp } from "@/components/ps-docs/credentials-help"
import { missingCookieNames } from "@/lib/ps-docs/credential"

/** Single `Cookie` input for the portal admin session (controlled version, used outside react-hook-form). */
export function CredentialsFields({ value, onChange }: { value: string; onChange: (next: string) => void }) {
  const missing = value.trim() ? missingCookieNames(value) : []

  return (
    <div className="space-y-2 rounded-md border p-4">
      <CredentialsHelp />
      <Field>
        <FieldLabel htmlFor="cookieHeader">Cookie</FieldLabel>
        <Textarea {...COOKIE_TEXTAREA_PROPS} value={value} onChange={(e) => onChange(e.target.value)} aria-invalid={missing.length > 0} />
        {missing.length > 0 && <p className="text-sm text-destructive">Faltando no cookie: {missing.join(", ")}</p>}
      </Field>
    </div>
  )
}
