"use client"

import { createClient, deleteClient, restoreClient, updateClient, bulkDeleteClients, setClientStatus } from "@/actions/admin/clients"
import { ConfirmDialog } from "@/components/shared/confirm-dialog"
import { DataTable } from "@/components/shared/data-table"
import { DataTableFilterPanel } from "@/components/shared/data-table-filter-panel"
import { EntityActionsCell } from "@/components/shared/entity-actions-cell"
import { PageHeader } from "@/components/shared/page-header"
import { createSelectColumn } from "@/components/shared/select-column"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Dialog, DialogBody, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Field, FieldError, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Checkbox } from "@/components/ui/checkbox"
import { Textarea } from "@/components/ui/textarea"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { formatDocument, formatPhone } from "@/lib/masks"
import { createClientSchema, updateClientSchema, type CreateClientInput } from "@/schemas/client.schema"
import type { PaginationMeta } from "@/types/common"
import { zodResolver } from "@hookform/resolvers/zod"
import type { Client } from "@/generated/prisma/client"
import type { ColumnDef } from "@tanstack/react-table"
import { ImagePlus, Loader2, Plus, Star, Upload, X } from "lucide-react"
import { useEffect, useRef, useState } from "react"
import { Controller, useForm, type Resolver } from "react-hook-form"
import { toast } from "sonner"
import { useCrudTable } from "@/hooks/use-crud-table"

interface ClientTableProps {
  data: Client[]
  meta: PaginationMeta
}

const SORTABLE_COLUMNS = ["name", "linkCrm", "document", "email", "status"]

export function ClientTable({ data, meta }: ClientTableProps) {
  const {
    router,
    searchParams,
    deleteDialog,
    setDeleteDialog,
    editDialog,
    setEditDialog,
    pushParams,
    handleDelete,
    handleToggleStatus,
    sort,
    onSortChange,
  } = useCrudTable<Client>({
    deleteAction: deleteClient,
    restoreAction: restoreClient,
    setStatusAction: setClientStatus,
    deleteSuccessMessage: "Cliente excluído com sucesso",
    restoreSuccessMessage: "Cliente restaurado com sucesso",
  })
  const [loading, setLoading] = useState(false)
  const [statusFilter, setStatusFilter] = useState(searchParams.get("status") || "")
  const [favoriteFilter, setFavoriteFilter] = useState(searchParams.get("favorite") || "")
  const [hasImageFilter, setHasImageFilter] = useState(searchParams.get("hasImage") || "")
  const [imageFile, setImageFile] = useState<File | null>(null)
  const [imageObjectUrl, setImageObjectUrl] = useState<string | null>(null)
  const [imageRemoved, setImageRemoved] = useState(false)
  const imageInputRef = useRef<HTMLInputElement>(null)
  const imagePreview = imageFile ? imageObjectUrl : imageRemoved ? null : editDialog.entity?.image || null

  useEffect(() => {
    if (!imageFile) return
    const url = URL.createObjectURL(imageFile)
    setImageObjectUrl(url)
    return () => URL.revokeObjectURL(url)
  }, [imageFile])

  const form = useForm<CreateClientInput>({
    mode: "onChange",
    resolver: zodResolver(editDialog.entity ? updateClientSchema : createClientSchema) as Resolver<CreateClientInput>,
    values: editDialog.entity
      ? {
          image: editDialog.entity.image || "",
          name: editDialog.entity.name,
          legalName: editDialog.entity.legalName || "",
          document: editDialog.entity.document || "",
          linkCrm: editDialog.entity.linkCrm || "",
          site: editDialog.entity.site || "",
          email: editDialog.entity.email || "",
          phone: editDialog.entity.phone || "",
          responsible: editDialog.entity.responsible || "",
          color: editDialog.entity.color,
          notes: editDialog.entity.notes || "",
          favorite: editDialog.entity.favorite,
          status: editDialog.entity.status,
        }
      : {
          image: "",
          name: "",
          legalName: "",
          document: "",
          linkCrm: "",
          site: "",
          email: "",
          phone: "",
          responsible: "",
          color: "#22c55e",
          notes: "",
          favorite: false,
          status: true,
        },
  })

  async function onSubmit(data: CreateClientInput) {
    setLoading(true)
    const formData = new FormData()
    Object.entries(data).forEach(([key, value]) => {
      if (key === "image") return
      if (value !== undefined) formData.append(key, String(value))
    })
    if (imageFile) formData.append("image", imageFile)
    else formData.append("image", imageRemoved ? "" : data.image || "")

    const result = editDialog.entity ? await updateClient(editDialog.entity.id, formData) : await createClient(formData)

    if (result.success) {
      toast.success(editDialog.entity ? "Cliente atualizado" : "Cliente criado")
      form.reset()
      setImageFile(null)
      setImageRemoved(false)
      setEditDialog({ open: false })
      router.refresh()
    } else {
      toast.error(result.error || "Erro ao salvar")
    }
    setLoading(false)
  }

  function handleCancel() {
    form.reset()
    setImageFile(null)
    setImageRemoved(false)
    setEditDialog({ open: false })
  }

  function handleRemoveImage() {
    setImageFile(null)
    setImageRemoved(true)
    if (imageInputRef.current) imageInputRef.current.value = ""
  }

  function handleReplaceImage() {
    imageInputRef.current?.click()
  }

  const columns: ColumnDef<Client>[] = [
    createSelectColumn<Client>(),
    {
      id: "image",
      header: "Logo",
      cell: ({ row }) => {
        const image = row.original.image
        if (!image) {
          return (
            <div className="flex h-10 w-10 items-center justify-center rounded-md border border-dashed border-input text-[10px] text-muted-foreground">
              —
            </div>
          )
        }
        return (
          <Tooltip>
            <TooltipTrigger
              render={
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={image}
                  alt={row.original.name}
                  className="h-10 w-10 rounded-md border border-input object-cover"
                />
              }
            />
            <TooltipContent side="right" className="max-w-none p-1">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={image} alt={row.original.name} className="h-48 w-48 rounded-md object-cover" />
            </TooltipContent>
          </Tooltip>
        )
      },
    },
    {
      accessorKey: "name",
      header: "Nome",
      cell: ({ row }) => (
        <div className="flex items-center gap-2">
          {row.original.favorite && <Star className="h-3.5 w-3.5 fill-yellow-400 text-yellow-400" />}
          {row.original.name}
        </div>
      ),
    },
    { accessorKey: "linkCrm", header: "Link CRM", cell: ({ row }) => row.getValue("linkCrm") || "-" },
    { accessorKey: "document", header: "CPF/CNPJ", cell: ({ row }) => row.getValue("document") || "-" },
    { accessorKey: "email", header: "E-mail", cell: ({ row }) => row.getValue("email") || "-" },
    {
      accessorKey: "status",
      header: "Status",
      cell: ({ row }) => {
        const status = row.getValue("status") as boolean
        return <Badge variant={status ? "default" : "secondary"}>{status ? "Ativo" : "Inativo"}</Badge>
      },
    },
    {
      id: "actions",
      cell: ({ row }) => (
        <EntityActionsCell
          onEdit={() => setEditDialog({ open: true, entity: row.original })}
          onDelete={() => setDeleteDialog({ open: true, id: row.original.id })}
          onToggleStatus={() => handleToggleStatus(row.original.id, row.original.status)}
          isActive={row.original.status}
        />
      ),
    },
  ]

  const newDialog = (
    <Dialog
      open={editDialog.open}
      onOpenChange={(open) => {
        setEditDialog({ open, entity: open ? editDialog.entity : undefined })
        if (!open) {
          form.reset()
          setImageFile(null)
          setImageRemoved(false)
        }
      }}
    >
      <DialogTrigger
        render={
          <Button>
            <Plus className="h-4 w-4 mr-2" /> Novo Cliente
          </Button>
        }
      />
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{editDialog.entity ? "Editar Cliente" : "Novo Cliente"}</DialogTitle>
        </DialogHeader>
        <form onSubmit={form.handleSubmit(onSubmit)} className="flex min-h-0 flex-1 flex-col overflow-hidden">
        <DialogBody>
          <div className="flex items-center gap-6">
            <div className="flex items-center gap-2">
              <Controller
                control={form.control}
                name="favorite"
                render={({ field }) => (
                  <button
                    type="button"
                    onClick={() => field.onChange(!field.value)}
                    aria-pressed={!!field.value}
                    aria-label="Favoritar"
                    className="flex items-center justify-center cursor-pointer"
                  >
                    <Star
                      className={
                        field.value ? "h-5 w-5 fill-yellow-400 text-yellow-400" : "h-5 w-5 text-muted-foreground"
                      }
                    />
                  </button>
                )}
              />
              <Label>Favorito</Label>
            </div>
            <div className="flex items-center gap-2">
              <Controller
                control={form.control}
                name="status"
                render={({ field }) => (
                  <Checkbox id="status" checked={field.value ?? true} onCheckedChange={(v) => field.onChange(!!v)} />
                )}
              />
              <Label htmlFor="status">Cliente ativo</Label>
            </div>
          </div>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <Field>
              <FieldLabel htmlFor="name">Nome</FieldLabel>
              <Input
                id="name"
                {...form.register("name")}
                placeholder="Nome do cliente"
                aria-invalid={!!form.formState.errors.name}
              />
              <FieldError errors={[form.formState.errors.name]} />
            </Field>
            <Field>
              <FieldLabel htmlFor="legalName">Razão Social</FieldLabel>
              <Input id="legalName" {...form.register("legalName")} placeholder="Razão social (opcional)" />
            </Field>
          </div>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <Field>
              <FieldLabel htmlFor="document">CPF/CNPJ</FieldLabel>
              <Controller
                control={form.control}
                name="document"
                render={({ field }) => (
                  <Input
                    id="document"
                    value={field.value ?? ""}
                    onChange={(e) => field.onChange(formatDocument(e.target.value))}
                    placeholder="Documento (opcional)"
                    aria-invalid={!!form.formState.errors.document}
                  />
                )}
              />
              <FieldError errors={[form.formState.errors.document]} />
            </Field>
            <Field>
              <FieldLabel htmlFor="responsible">Responsável</FieldLabel>
              <Input id="responsible" {...form.register("responsible")} placeholder="Responsável (opcional)" />
            </Field>
          </div>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <Field>
              <FieldLabel htmlFor="email">E-mail</FieldLabel>
              <Input
                id="email"
                type="email"
                {...form.register("email")}
                placeholder="email@exemplo.com"
                aria-invalid={!!form.formState.errors.email}
              />
              <FieldError errors={[form.formState.errors.email]} />
            </Field>
            <Field>
              <FieldLabel htmlFor="phone">Telefone</FieldLabel>
              <Controller
                control={form.control}
                name="phone"
                render={({ field }) => (
                  <Input
                    id="phone"
                    value={field.value ?? ""}
                    onChange={(e) => field.onChange(formatPhone(e.target.value))}
                    placeholder="(00) 00000-0000"
                    aria-invalid={!!form.formState.errors.phone}
                  />
                )}
              />
              <FieldError errors={[form.formState.errors.phone]} />
            </Field>
          </div>
          <fieldset className="space-y-3 rounded-lg border border-input p-3">
            <legend className="px-1 text-sm font-medium text-muted-foreground">Integração TOTVS (opcional)</legend>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <Field>
                <FieldLabel htmlFor="linkCrm">Link CRM</FieldLabel>
                <Input
                  id="linkCrm"
                  {...form.register("linkCrm")}
                  placeholder="https://crm.exemplo.com"
                  aria-invalid={!!form.formState.errors.linkCrm}
                />
                <FieldError errors={[form.formState.errors.linkCrm]} />
              </Field>
              <Field>
                <FieldLabel htmlFor="site">Site</FieldLabel>
                <Input
                  id="site"
                  {...form.register("site")}
                  placeholder="https://site.com.br"
                  aria-invalid={!!form.formState.errors.site}
                />
                <FieldError errors={[form.formState.errors.site]} />
              </Field>
            </div>
            <Field>
              <FieldLabel htmlFor="image">Imagem</FieldLabel>
              <input
                ref={imageInputRef}
                id="image"
                type="file"
                accept="image/png,image/jpeg,image/webp,image/gif"
                onChange={(e) => {
                  const file = e.target.files?.[0] ?? null
                  setImageFile(file)
                  if (file) setImageRemoved(false)
                }}
                className="hidden"
              />
              {imagePreview ? (
                <div className="mt-2 space-y-2">
                  <div className="h-40 w-full overflow-hidden rounded-md border border-input">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={imagePreview} alt="Pré-visualização" className="h-full w-full object-cover" />
                  </div>
                  <div className="flex gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={handleReplaceImage}
                      className="cursor-pointer"
                    >
                      <Upload className="h-4 w-4 mr-2" /> Substituir
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={handleRemoveImage}
                      className="cursor-pointer text-destructive hover:text-destructive"
                    >
                      <X className="h-4 w-4 mr-2" /> Remover
                    </Button>
                  </div>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={handleReplaceImage}
                  className="mt-2 flex h-40 w-full flex-col items-center justify-center gap-1 rounded-md border border-dashed border-input text-muted-foreground transition-colors hover:border-primary hover:text-primary cursor-pointer"
                >
                  <ImagePlus className="h-6 w-6" />
                  <span className="text-xs">Anexar imagem</span>
                </button>
              )}
            </Field>
            <Field className="w-[30%]">
              <FieldLabel htmlFor="color">Cor</FieldLabel>
              <Input id="color" type="color" className="h-9 w-20 p-1" {...form.register("color")} />
            </Field>
          </fieldset>
          <Field>
            <FieldLabel htmlFor="notes">Observações</FieldLabel>
            <Textarea id="notes" {...form.register("notes")} placeholder="Observações (opcional)" />
          </Field>
        </DialogBody>
        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={handleCancel}
            disabled={loading}
            className="w-full sm:w-auto"
          >
            Cancelar
          </Button>
          <Button type="submit" disabled={loading} className="w-full sm:w-auto">
            {loading && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
            Salvar
          </Button>
        </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )

  const filterPanel = (
    <DataTableFilterPanel
      onApply={() =>
        pushParams({
          status: statusFilter || undefined,
          favorite: favoriteFilter || undefined,
          hasImage: hasImageFilter || undefined,
          page: 1,
        })
      }
      onClear={() => {
        setStatusFilter("")
        setFavoriteFilter("")
        setHasImageFilter("")
        pushParams({ status: undefined, favorite: undefined, hasImage: undefined, page: 1 })
      }}
    >
      <div className="space-y-2">
        <Label>Status</Label>
        <Select
          items={[
            { value: "all", label: "Todos" },
            { value: "true", label: "Ativo" },
            { value: "false", label: "Inativo" },
          ]}
          value={statusFilter || "all"}
          onValueChange={(v) => setStatusFilter(v === "all" || !v ? "" : v)}
        >
          <SelectTrigger className="w-full">
            <SelectValue placeholder="Todos" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos</SelectItem>
            <SelectItem value="true">Ativo</SelectItem>
            <SelectItem value="false">Inativo</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <div className="space-y-2">
        <Label>Favoritos</Label>
        <Select
          items={[
            { value: "all", label: "Todos" },
            { value: "true", label: "Sim" },
            { value: "false", label: "Não" },
          ]}
          value={favoriteFilter || "all"}
          onValueChange={(v) => setFavoriteFilter(v === "all" || !v ? "" : v)}
        >
          <SelectTrigger className="w-full">
            <SelectValue placeholder="Todos" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos</SelectItem>
            <SelectItem value="true">Sim</SelectItem>
            <SelectItem value="false">Não</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <div className="space-y-2">
        <Label>Possui imagem</Label>
        <Select
          items={[
            { value: "all", label: "Todos" },
            { value: "true", label: "Sim" },
            { value: "false", label: "Não" },
          ]}
          value={hasImageFilter || "all"}
          onValueChange={(v) => setHasImageFilter(v === "all" || !v ? "" : v)}
        >
          <SelectTrigger className="w-full">
            <SelectValue placeholder="Todos" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos</SelectItem>
            <SelectItem value="true">Sim</SelectItem>
            <SelectItem value="false">Não</SelectItem>
          </SelectContent>
        </Select>
      </div>
    </DataTableFilterPanel>
  )

  return (
    <>
      <PageHeader title="Clientes" description="Gerenciar clientes (TOTVS RM e demandas)" />

      <DataTable
        columns={columns}
        data={data}
        page={meta.page}
        pageSize={meta.pageSize}
        total={meta.total}
        pageCount={meta.totalPages}
        onPageChange={(p) => pushParams({ page: p })}
        onPageSizeChange={(ps) => pushParams({ pageSize: ps, page: 1 })}
        searchPlaceholder="Buscar por nome, documento, e-mail ou link CRM..."
        onSearch={(v) => pushParams({ search: v || undefined, page: 1 })}
        toolbarActions={newDialog}
        filterPanel={filterPanel}
        sort={sort}
        onSortChange={onSortChange}
        sortableColumns={SORTABLE_COLUMNS}
        bulkDelete={{
          getId: (row) => row.id,
          getRowLabel: (row) => row.name,
          action: bulkDeleteClients,
          onSuccess: () => router.refresh(),
        }}
      />

      <ConfirmDialog
        open={deleteDialog.open}
        onOpenChange={(open) => setDeleteDialog({ open, id: deleteDialog.id })}
        title="Excluir Cliente"
        description="Tem certeza que deseja excluir este cliente? Esta ação pode ser revertida posteriormente."
        confirmLabel="Excluir"
        variant="destructive"
        onConfirm={() => deleteDialog.id && handleDelete(deleteDialog.id)}
      />
    </>
  )
}
