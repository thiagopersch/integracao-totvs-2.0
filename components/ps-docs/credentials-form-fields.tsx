"use client"

import { Controller, type Control, type FieldErrors } from "react-hook-form"
import { Input } from "@/components/ui/input"
import { PasswordInput } from "@/components/ui/password-input"
import { Field, FieldError, FieldLabel } from "@/components/ui/field"
import type { PsDocsFormInput } from "@/schemas/ps-docs.schema"

interface CredentialsFormFieldsProps {
  control: Control<PsDocsFormInput>
  errors: FieldErrors<PsDocsFormInput>
}

/** Four cookie inputs for the portal admin session, bound to the page's react-hook-form. */
export function CredentialsFormFields({ control, errors }: CredentialsFormFieldsProps) {
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
          <Controller
            control={control}
            name="branch"
            render={({ field }) => <Input id="cookieBranch" {...field} placeholder="master" aria-invalid={!!errors.branch} />}
          />
          <FieldError errors={[errors.branch]} />
        </Field>
        <Field>
          <FieldLabel htmlFor="cookieClientId">client_id</FieldLabel>
          <Controller
            control={control}
            name="clientId"
            render={({ field }) => (
              <PasswordInput id="cookieClientId" value={field.value} onChange={field.onChange} onBlur={field.onBlur} placeholder="Value do cookie client_id" aria-invalid={!!errors.clientId} />
            )}
          />
          <FieldError errors={[errors.clientId]} />
        </Field>
        <Field>
          <FieldLabel htmlFor="cookieSession">inscricoes_session</FieldLabel>
          <Controller
            control={control}
            name="session"
            render={({ field }) => (
              <PasswordInput id="cookieSession" value={field.value} onChange={field.onChange} onBlur={field.onBlur} placeholder="Value do cookie inscricoes_session" aria-invalid={!!errors.session} />
            )}
          />
          <FieldError errors={[errors.session]} />
        </Field>
        <Field>
          <FieldLabel htmlFor="cookieXsrf">XSRF-TOKEN</FieldLabel>
          <Controller
            control={control}
            name="xsrf"
            render={({ field }) => (
              <PasswordInput id="cookieXsrf" value={field.value} onChange={field.onChange} onBlur={field.onBlur} placeholder="Value do cookie XSRF-TOKEN" aria-invalid={!!errors.xsrf} />
            )}
          />
          <FieldError errors={[errors.xsrf]} />
        </Field>
      </div>
    </div>
  )
}
