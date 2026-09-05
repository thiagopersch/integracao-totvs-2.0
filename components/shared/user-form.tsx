"use client"

import { useForm, Controller, type Resolver } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { createUserSchema, updateUserSchema, type CreateUserInput } from "@/schemas/user.schema"
import { createUser, updateUser } from "@/actions/admin/users"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { PasswordInput } from "@/components/ui/password-input"
import { Label } from "@/components/ui/label"
import { Checkbox } from "@/components/ui/checkbox"
import { Field, FieldLabel, FieldError } from "@/components/ui/field"
import { DialogBody, DialogFooter } from "@/components/ui/dialog"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { toast } from "sonner"
import { Loader2 } from "lucide-react"
import { useState } from "react"
import type { User } from "@/generated/prisma/client"

interface UserFormProps {
  user?: User
  onSuccess: () => void
  onCancel: () => void
}

export function UserForm({ user, onSuccess, onCancel }: UserFormProps) {
  const [loading, setLoading] = useState(false)

  const {
    register,
    control,
    handleSubmit,
    setValue,
    reset,
    formState: { errors },
  } = useForm<CreateUserInput>({
    mode: "onChange",
    resolver: zodResolver(user ? updateUserSchema : createUserSchema) as Resolver<CreateUserInput>,
    defaultValues: user
      ? { name: user.name, email: user.email, role: user.role, status: user.status, changePassword: user.changePassword }
      : { status: true, role: "USER", changePassword: false },
  })

  async function onSubmit(data: CreateUserInput) {
    setLoading(true)
    const formData = new FormData()
    Object.entries(data).forEach(([key, value]) => {
      if (value !== undefined) formData.append(key, String(value))
    })

    const result = user ? await updateUser(user.id, formData) : await createUser(formData)

    if (result.success) {
      toast.success(user ? "Usuário atualizado" : "Usuário criado")
      reset()
      onSuccess()
    } else {
      toast.error(result.error || "Erro ao salvar")
    }
    setLoading(false)
  }

  function handleCancel() {
    reset()
    onCancel()
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="flex min-h-0 flex-1 flex-col overflow-hidden">
      <DialogBody>
        <div className="flex items-center gap-2">
          <Controller
            control={control}
            name="status"
            render={({ field }) => (
              <Checkbox id="status" checked={field.value} onCheckedChange={(v) => field.onChange(v === true)} />
            )}
          />
          <Label htmlFor="status">Usuário ativo</Label>
        </div>
        <div className="flex items-center gap-2">
          <Controller
            control={control}
            name="changePassword"
            render={({ field }) => (
              <Checkbox
                id="changePassword"
                checked={field.value ?? false}
                onCheckedChange={(v) => field.onChange(v === true)}
              />
            )}
          />
          <Label htmlFor="changePassword">Forçar redefinição de senha no próximo login</Label>
        </div>
        <Field>
          <FieldLabel htmlFor="name">Nome</FieldLabel>
          <Input id="name" {...register("name")} placeholder="Nome completo" aria-invalid={!!errors.name} />
          <FieldError errors={[errors.name]} />
        </Field>
        <Field>
          <FieldLabel htmlFor="email">E-mail</FieldLabel>
          <Input id="email" type="email" {...register("email")} placeholder="email@exemplo.com" aria-invalid={!!errors.email} />
          <FieldError errors={[errors.email]} />
        </Field>
        {!user && (
          <Field>
            <FieldLabel htmlFor="password">Senha</FieldLabel>
            <Controller
              control={control}
              name="password"
              render={({ field }) => (
                <PasswordInput
                  id="password"
                  value={field.value}
                  onChange={field.onChange}
                  onBlur={field.onBlur}
                  placeholder="Senha de acesso"
                  aria-invalid={!!errors.password}
                  showStrength
                />
              )}
            />
            <FieldError errors={[errors.password]} />
          </Field>
        )}
        <div className="w-[30%] space-y-2">
          <Label htmlFor="role">Perfil</Label>
          <Select
            items={[
              { value: "ADMIN", label: "Administrador" },
              { value: "MANAGER", label: "Gerente" },
              { value: "USER", label: "Usuário" },
            ]}
            defaultValue={user?.role || "USER"}
            onValueChange={(v) => setValue("role", v || "USER")}
          >
            <SelectTrigger>
              <SelectValue placeholder="Selecione o perfil" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ADMIN">Administrador</SelectItem>
              <SelectItem value="MANAGER">Gerente</SelectItem>
              <SelectItem value="USER">Usuário</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </DialogBody>
      <DialogFooter>
        <Button type="button" variant="outline" onClick={handleCancel} disabled={loading}>Cancelar</Button>
        <Button type="submit" disabled={loading}>
          {loading && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
          Salvar
        </Button>
      </DialogFooter>
    </form>
  )
}
