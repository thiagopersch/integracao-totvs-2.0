"use client"

import { Controller, type Control, type FieldErrors } from "react-hook-form"
import { Textarea } from "@/components/ui/textarea"
import { Field, FieldError, FieldLabel } from "@/components/ui/field"
import { COOKIE_TEXTAREA_PROPS, CredentialsHelp } from "@/components/ps-docs/credentials-help"
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
        <FieldLabel htmlFor="psAdminSession">Cookie</FieldLabel>
        <Controller
          control={control}
          name="cookie"
          render={({ field }) => <Textarea {...COOKIE_TEXTAREA_PROPS} {...field} aria-invalid={!!errors.cookie} />}
        />
        <FieldError errors={[errors.cookie]} />
      </Field>
    </div>
  )
}
