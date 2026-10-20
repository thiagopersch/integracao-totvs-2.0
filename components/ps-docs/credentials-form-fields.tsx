"use client"

import { Controller, type Control, type FieldErrors } from "react-hook-form"
import { PasswordInput } from "@/components/ui/password-input"
import { Field, FieldError, FieldLabel } from "@/components/ui/field"
import { CredentialsHelp } from "@/components/ps-docs/credentials-help"
import type { PsDocsFormInput } from "@/schemas/ps-docs.schema"

interface CredentialsFormFieldsProps {
  control: Control<PsDocsFormInput>
  errors: FieldErrors<PsDocsFormInput>
}

/** Single `Cookie` input for the portal admin session, bound to the page's react-hook-form. */
export function CredentialsFormFields({ control, errors }: CredentialsFormFieldsProps) {
  return (
    <div className="space-y-2 rounded-md border p-4">
      <CredentialsHelp />
      <Field>
        <FieldLabel htmlFor="cookieHeader">Cookie</FieldLabel>
        <Controller
          control={control}
          name="cookie"
          render={({ field }) => (
            <PasswordInput
              id="cookieHeader"
              value={field.value}
              onChange={field.onChange}
              onBlur={field.onBlur}
              placeholder="branch=master; client_id=...; inscricoes_session=...; XSRF-TOKEN=..."
              aria-invalid={!!errors.cookie}
            />
          )}
        />
        <FieldError errors={[errors.cookie]} />
      </Field>
    </div>
  )
}
