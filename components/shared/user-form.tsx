"use client"

import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { createUserSchema, updateUserSchema } from "@/schemas/user.schema"
import { createUser, updateUser } from "@/actions/admin/users"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Field, FieldLabel, FieldError } from "@/components/ui/field"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { toast } from "sonner"
import { Loader2 } from "lucide-react"
import { useState } from "react"
import type { User } from "@prisma/client"

interface UserFormProps {
  user?: User
  onSuccess: () => void
  onCancel: () => void
}

export function UserForm({ user, onSuccess, onCancel }: UserFormProps) {
  const [loading, setLoading] = useState(false)

  const {
    register,
    handleSubmit,
    setValue,
    reset,
    formState: { errors },
  } = useForm<any>({
    resolver: zodResolver(user ? updateUserSchema : createUserSchema),
    defaultValues: user
      ? { name: user.name, email: user.email, role: user.role, status: user.status }
      : { status: true, role: "USER" },
  })

  async function onSubmit(data: any) {
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
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
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
          <Input id="password" type="password" {...register("password")} placeholder="Mínimo 6 caracteres" aria-invalid={!!errors.password} />
          <FieldError errors={[errors.password]} />
        </Field>
      )}
      <div className="space-y-2">
        <Label htmlFor="role">Perfil</Label>
        <Select defaultValue={user?.role || "USER"} onValueChange={(v) => setValue("role", v)}>
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
      <div className="flex items-center gap-2">
        <input type="checkbox" id="status" defaultChecked={user?.status ?? true} {...register("status")} className="rounded border-gray-300" />
        <Label htmlFor="status">Usuário ativo</Label>
      </div>
      <div className="flex items-center justify-end gap-2">
        <Button type="button" variant="outline" onClick={handleCancel} disabled={loading}>Cancelar</Button>
        <Button type="submit" disabled={loading}>
          {loading && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
          Salvar
        </Button>
      </div>
    </form>
  )
}
