"use client"

import { useState } from "react"
import type { ColumnDef } from "@tanstack/react-table"
import { useForm, type Resolver } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { DataTable } from "@/components/shared/data-table"
import { PageHeader } from "@/components/shared/page-header"
import { ConfirmDialog } from "@/components/shared/confirm-dialog"
import { EntityActionsCell } from "@/components/shared/entity-actions-cell"
import { createSelectColumn } from "@/components/shared/select-column"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Field, FieldLabel, FieldError } from "@/components/ui/field"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Plus, Loader2, ShieldCheck, ShieldAlert } from "lucide-react"
import {
  deleteDataserver,
  restoreDataserver,
  createDataserver,
  updateDataserver,
  validateDataserverCode,
  bulkDeleteDataservers,
} from "@/actions/admin/dataservers"
import { createDataserverSchema, updateDataserverSchema, type CreateDataserverInput } from "@/schemas/dataserver.schema"
import { toast } from "sonner"
import { useCrudTable } from "@/hooks/use-crud-table"
import type { Dataserver } from "@prisma/client"
import type { PaginationMeta } from "@/types/common"

interface DataserverTableProps {
  data: Dataserver[]
  meta: PaginationMeta
  tbcs: { id: string; name: string }[]
}

export function DataserverTable({ data, meta, tbcs }: DataserverTableProps) {
  const {
    router,
    deleteDialog,
    setDeleteDialog,
    editDialog,
    setEditDialog,
    pushParams,
    handleDelete,
  } = useCrudTable<Dataserver>({
    deleteAction: deleteDataserver,
    restoreAction: restoreDataserver,
    deleteSuccessMessage: "Dataserver excluído com sucesso",
    restoreSuccessMessage: "Dataserver restaurado com sucesso",
  })
  const [loading, setLoading] = useState(false)
  const [validationTbcId, setValidationTbcId] = useState("")
  const [validating, setValidating] = useState(false)
  const [validatedCode, setValidatedCode] = useState<string | null>(null)

  const form = useForm<CreateDataserverInput>({
    mode: "onChange",
    resolver: zodResolver(editDialog.entity ? updateDataserverSchema : createDataserverSchema) as Resolver<CreateDataserverInput>,
    values: editDialog.entity
      ? { code: editDialog.entity.code, nameAlternative: editDialog.entity.nameAlternative || "", name: editDialog.entity.name }
      : { code: "", nameAlternative: "", name: "" },
  })

  const code = form.watch("code")
  const isValidated = !!code && code === validatedCode

  async function handleValidate() {
    if (!validationTbcId) { toast.error("Selecione um TBC para validar"); return }
    if (!code?.trim()) { toast.error("Informe o código do dataserver"); return }

    setValidating(true)
    try {
      const result = await validateDataserverCode(validationTbcId, code.trim())
      if (!result.success) {
        toast.error(result.error || "Erro ao validar dataserver")
      } else if (result.valid) {
        setValidatedCode(code)
        toast.success("Dataserver válido — pode salvar")
      } else {
        setValidatedCode(null)
        toast.error("Dataserver inválido nesse TBC")
      }
    } finally {
      setValidating(false)
    }
  }

  async function onSubmit(data: CreateDataserverInput) {
    setLoading(true)
    const formData = new FormData()
    Object.entries(data).forEach(([key, value]) => {
      if (value !== undefined) formData.append(key, String(value))
    })

    const result = editDialog.entity
      ? await updateDataserver(editDialog.entity.id, formData)
      : await createDataserver(formData)

    if (result.success) {
      toast.success(editDialog.entity ? "Dataserver atualizado" : "Dataserver criado")
      form.reset()
      setValidatedCode(null)
      setEditDialog({ open: false })
      router.refresh()
    } else {
      toast.error(result.error || "Erro ao salvar")
    }
    setLoading(false)
  }

  function handleCancel() {
    form.reset()
    setValidatedCode(null)
    setEditDialog({ open: false })
  }

  const columns: ColumnDef<Dataserver>[] = [
    createSelectColumn<Dataserver>(),
    {
      accessorKey: "code",
      header: "Código",
    },
    {
      accessorKey: "name",
      header: "Nome",
    },
    {
      accessorKey: "nameAlternative",
      header: "Nome Alternativo",
      cell: ({ row }) => row.getValue("nameAlternative") || "-",
    },
    {
      id: "actions",
      cell: ({ row }) => (
        <EntityActionsCell
          onEdit={() => setEditDialog({ open: true, entity: row.original })}
          onDelete={() => setDeleteDialog({ open: true, id: row.original.id })}
        />
      ),
    },
  ]

  const newDialog = (
    <Dialog
      open={editDialog.open}
      onOpenChange={(open) => {
        setEditDialog({ open, entity: open ? editDialog.entity : undefined })
        if (!open) { form.reset(); setValidatedCode(null); setValidationTbcId("") }
      }}
    >
      <DialogTrigger render={<Button><Plus className="h-4 w-4 mr-2" /> Novo Dataserver</Button>} />
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{editDialog.entity ? "Editar Dataserver" : "Novo Dataserver"}</DialogTitle>
        </DialogHeader>
        <form onSubmit={form.handleSubmit(onSubmit)} className="flex min-h-0 flex-1 flex-col overflow-hidden">
        <DialogBody>
          <Field>
            <FieldLabel htmlFor="code">Código</FieldLabel>
            <Input
              id="code"
              {...form.register("code", { onChange: () => setValidatedCode(null) })}
              placeholder="Código único (DataServerName no TOTVS)"
              aria-invalid={!!form.formState.errors.code}
            />
            <FieldError errors={[form.formState.errors.code]} />
          </Field>
          <Field>
            <FieldLabel htmlFor="validationTbc">TBC para validação</FieldLabel>
            <div className="flex items-center gap-2">
              <Select
                items={tbcs.map((t) => ({ value: t.id, label: t.name }))}
                value={validationTbcId || null}
                onValueChange={(v) => { setValidationTbcId(v || ""); setValidatedCode(null) }}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Selecionar TBC..." />
                </SelectTrigger>
                <SelectContent>
                  {tbcs.map((t) => (
                    <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button type="button" variant="secondary" onClick={handleValidate} disabled={validating} className="shrink-0">
                {validating ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : isValidated ? <ShieldCheck className="h-4 w-4 mr-2" /> : <ShieldAlert className="h-4 w-4 mr-2" />}
                Validar
              </Button>
            </div>
          </Field>
          <Field>
            <FieldLabel htmlFor="name">Nome</FieldLabel>
            <Input id="name" {...form.register("name")} placeholder="Nome do dataserver" aria-invalid={!!form.formState.errors.name} />
            <FieldError errors={[form.formState.errors.name]} />
          </Field>
          <Field>
            <FieldLabel htmlFor="nameAlternative">Nome Alternativo</FieldLabel>
            <Input id="nameAlternative" {...form.register("nameAlternative")} placeholder="Nome alternativo (opcional)" />
          </Field>
        </DialogBody>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={handleCancel} disabled={loading}>Cancelar</Button>
          <Button type="submit" disabled={loading || !isValidated} title={!isValidated ? "Valide o dataserver antes de salvar" : undefined}>
            {loading && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
            Salvar
          </Button>
        </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )

  return (
    <>
      <PageHeader title="Dataservers" description="Gerenciar dataservers" />

      <DataTable
        columns={columns}
        data={data}
        page={meta.page}
        pageSize={meta.pageSize}
        total={meta.total}
        pageCount={meta.totalPages}
        onPageChange={(p) => pushParams({ page: p })}
        onPageSizeChange={(ps) => pushParams({ pageSize: ps, page: 1 })}
        searchPlaceholder="Buscar por código ou nome..."
        onSearch={(v) => pushParams({ search: v || undefined, page: 1 })}
        toolbarActions={newDialog}
        bulkDelete={{
          getId: (row) => row.id,
          getRowLabel: (row) => row.code,
          action: bulkDeleteDataservers,
          onSuccess: () => router.refresh(),
        }}
      />

      <ConfirmDialog
        open={deleteDialog.open}
        onOpenChange={(open) => setDeleteDialog({ open, id: deleteDialog.id })}
        title="Excluir Dataserver"
        description="Tem certeza que deseja excluir este dataserver? Esta ação pode ser revertida posteriormente."
        confirmLabel="Excluir"
        variant="destructive"
        onConfirm={() => deleteDialog.id && handleDelete(deleteDialog.id)}
      />
    </>
  )
}
