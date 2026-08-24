"use client"

import { useState } from "react"
import { useForm, Controller } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Field, FieldLabel, FieldError } from "@/components/ui/field"
import { PasswordInput } from "@/components/ui/password-input"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Loader2 } from "lucide-react"
import { toast } from "sonner"
import { updateProfileAction } from "@/actions/auth/profile"
import { changePasswordAction } from "@/actions/auth/login"
import { changePasswordSchema } from "@/schemas/auth.schema"
import { z } from "zod"
import type { AuthUser } from "@/types/auth"

const profileSchema = z.object({
  name: z.string().min(3, "Nome deve ter no mínimo 3 caracteres"),
  image: z.string().url("URL inválida").optional().or(z.literal("")),
})

interface ProfileFormProps {
  user: AuthUser
}

export function ProfileForm({ user }: ProfileFormProps) {
  const [profileLoading, setProfileLoading] = useState(false)
  const [passwordLoading, setPasswordLoading] = useState(false)

  const profileForm = useForm<z.infer<typeof profileSchema>>({
    mode: "onChange",
    resolver: zodResolver(profileSchema),
    defaultValues: { name: user.name, image: "" },
  })

  const passwordForm = useForm<z.infer<typeof changePasswordSchema>>({
    mode: "onChange",
    resolver: zodResolver(changePasswordSchema),
    defaultValues: { currentPassword: "", newPassword: "", confirmPassword: "" },
  })

  async function onProfileSubmit(data: z.infer<typeof profileSchema>) {
    setProfileLoading(true)
    const formData = new FormData()
    formData.append("name", data.name)
    if (data.image) formData.append("image", data.image)

    const result = await updateProfileAction(formData)
    if (result.success) {
      toast.success("Perfil atualizado")
    } else {
      toast.error(result.error || "Erro ao atualizar perfil")
    }
    setProfileLoading(false)
  }

  async function onPasswordSubmit(data: z.infer<typeof changePasswordSchema>) {
    setPasswordLoading(true)
    const formData = new FormData()
    formData.append("userId", user.id)
    formData.append("currentPassword", data.currentPassword)
    formData.append("newPassword", data.newPassword)

    const result = await changePasswordAction(formData)
    if (result.success) {
      toast.success("Senha alterada com sucesso")
      passwordForm.reset()
    } else {
      toast.error(result.error || "Erro ao alterar senha")
    }
    setPasswordLoading(false)
  }

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
      <Card>
        <CardHeader>
          <CardTitle>Dados do perfil</CardTitle>
          <CardDescription>Atualize seu nome e avatar</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={profileForm.handleSubmit(onProfileSubmit)} className="space-y-4">
            <div className="flex items-center gap-4">
              <Avatar className="h-16 w-16">
                <AvatarImage src={profileForm.watch("image") || undefined} />
                <AvatarFallback>{user.name.slice(0, 2).toUpperCase()}</AvatarFallback>
              </Avatar>
              <Field className="flex-1">
                <FieldLabel htmlFor="image">URL do avatar</FieldLabel>
                <Input id="image" {...profileForm.register("image")} placeholder="https://... (opcional)" aria-invalid={!!profileForm.formState.errors.image} />
                <FieldError errors={[profileForm.formState.errors.image]} />
              </Field>
            </div>
            <Field>
              <FieldLabel htmlFor="name">Nome</FieldLabel>
              <Input id="name" {...profileForm.register("name")} aria-invalid={!!profileForm.formState.errors.name} />
              <FieldError errors={[profileForm.formState.errors.name]} />
            </Field>
            <div className="space-y-2">
              <Label>E-mail</Label>
              <Input value={user.email} disabled />
            </div>
            <Button type="submit" disabled={profileLoading}>
              {profileLoading && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
              Salvar
            </Button>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Alterar senha</CardTitle>
          <CardDescription>Sua senha deve ser forte e única</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={passwordForm.handleSubmit(onPasswordSubmit)} className="space-y-4">
            <Field>
              <FieldLabel htmlFor="currentPassword">Senha atual</FieldLabel>
              <Controller
                control={passwordForm.control}
                name="currentPassword"
                render={({ field }) => (
                  <PasswordInput
                    value={field.value}
                    onChange={field.onChange}
                    onBlur={field.onBlur}
                    aria-invalid={!!passwordForm.formState.errors.currentPassword}
                    placeholder="Senha atual"
                  />
                )}
              />
              <FieldError errors={[passwordForm.formState.errors.currentPassword]} />
            </Field>
            <Field>
              <FieldLabel htmlFor="newPassword">Nova senha</FieldLabel>
              <Controller
                control={passwordForm.control}
                name="newPassword"
                render={({ field }) => (
                  <PasswordInput
                    value={field.value}
                    onChange={field.onChange}
                    onBlur={field.onBlur}
                    aria-invalid={!!passwordForm.formState.errors.newPassword}
                    placeholder="Nova senha"
                    showStrength
                  />
                )}
              />
              <FieldError errors={[passwordForm.formState.errors.newPassword]} />
            </Field>
            <Field>
              <FieldLabel htmlFor="confirmPassword">Confirmar nova senha</FieldLabel>
              <Controller
                control={passwordForm.control}
                name="confirmPassword"
                render={({ field }) => (
                  <PasswordInput
                    value={field.value}
                    onChange={field.onChange}
                    onBlur={field.onBlur}
                    aria-invalid={!!passwordForm.formState.errors.confirmPassword}
                    placeholder="Confirme a nova senha"
                  />
                )}
              />
              <FieldError errors={[passwordForm.formState.errors.confirmPassword]} />
            </Field>
            <Button type="submit" disabled={passwordLoading}>
              {passwordLoading && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
              Alterar senha
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
