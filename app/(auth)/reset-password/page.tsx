"use client"

import { useState } from "react"
import { useForm, Controller } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { completeForcedPasswordReset } from "@/actions/auth/login"
import { resetPasswordSchema, type ResetPasswordInput } from "@/schemas/auth.schema"
import { Button } from "@/components/ui/button"
import { PasswordInput } from "@/components/ui/password-input"
import { Field, FieldLabel, FieldError } from "@/components/ui/field"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { toast } from "sonner"
import { Loader2, KeyRound } from "lucide-react"

export default function ResetPasswordPage() {
  const [loading, setLoading] = useState(false)

  const {
    control,
    handleSubmit,
    formState: { errors },
  } = useForm<ResetPasswordInput>({
    resolver: zodResolver(resetPasswordSchema),
  })

  async function onSubmit(data: ResetPasswordInput) {
    setLoading(true)
    const formData = new FormData()
    formData.append("newPassword", data.newPassword)
    formData.append("confirmPassword", data.confirmPassword)

    const result = await completeForcedPasswordReset(formData)

    if (result.success) {
      toast.success("Senha redefinida com sucesso!")
      // A full navigation (not router.push) — the Server Action above already mutated this same
      // user's session-relevant data, and Next's implicit post-action revalidation of this route
      // races with a soft client-side push, silently swallowing it. A hard navigation sidesteps
      // that entirely and is a fine trade-off for a once-per-forced-reset page.
      window.location.href = "redirectTo" in result ? result.redirectTo : "/dashboard"
    } else {
      toast.error("error" in result ? result.error : "Erro ao redefinir senha")
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-zinc-100 to-zinc-200 dark:from-zinc-900 dark:to-zinc-800 p-4">
      <Card className="w-full max-w-md shadow-xl">
        <CardHeader className="text-center space-y-2">
          <div className="mx-auto bg-primary/10 p-3 rounded-full w-fit">
            <KeyRound className="h-8 w-8 text-primary" />
          </div>
          <CardTitle className="text-2xl font-bold">Redefinir senha</CardTitle>
          <CardDescription>Defina uma nova senha para continuar acessando o sistema</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <Field>
              <FieldLabel htmlFor="newPassword">Nova senha</FieldLabel>
              <Controller
                control={control}
                name="newPassword"
                render={({ field }) => (
                  <PasswordInput
                    id="newPassword"
                    value={field.value}
                    onChange={field.onChange}
                    onBlur={field.onBlur}
                    placeholder="Nova senha"
                    autoComplete="new-password"
                    aria-invalid={!!errors.newPassword}
                    showStrength
                  />
                )}
              />
              <FieldError errors={[errors.newPassword]} />
            </Field>
            <Field>
              <FieldLabel htmlFor="confirmPassword">Confirmar nova senha</FieldLabel>
              <Controller
                control={control}
                name="confirmPassword"
                render={({ field }) => (
                  <PasswordInput
                    id="confirmPassword"
                    value={field.value}
                    onChange={field.onChange}
                    onBlur={field.onBlur}
                    placeholder="Repita a nova senha"
                    autoComplete="new-password"
                    aria-invalid={!!errors.confirmPassword}
                  />
                )}
              />
              <FieldError errors={[errors.confirmPassword]} />
            </Field>
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              Concluir redefinição
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
