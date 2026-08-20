"use client"

import { Fragment, useState } from "react"
import { useRouter } from "next/navigation"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { PageHeader } from "@/components/shared/page-header"
import { ConfirmDialog } from "@/components/shared/confirm-dialog"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { FieldError } from "@/components/ui/field"
import { Checkbox } from "@/components/ui/checkbox"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import {
  MoreHorizontal,
  Plus,
  Trash2,
  Pencil,
  Loader2,
  ChevronDown,
  ChevronRight,
  Search,
} from "lucide-react"
import {
  createSoapEndpointType,
  updateSoapEndpointType,
  deleteSoapEndpointType,
  restoreSoapEndpointType,
  createSoapEndpointMethod,
  updateSoapEndpointMethod,
  deleteSoapEndpointMethod,
  restoreSoapEndpointMethod,
} from "@/actions/admin/soap-endpoints"
import {
  createSoapEndpointTypeSchema,
  updateSoapEndpointTypeSchema,
  createSoapEndpointMethodSchema,
  updateSoapEndpointMethodSchema,
} from "@/schemas/soap-endpoint.schema"
import { toast } from "sonner"
import type { SoapEndpointType, SoapEndpointMethod } from "@prisma/client"
import type { PaginationMeta } from "@/types/common"

type SoapEndpointTypeWithMethods = SoapEndpointType & { methods: SoapEndpointMethod[] }

interface SoapEndpointTableProps {
  data: SoapEndpointTypeWithMethods[]
  meta: PaginationMeta
}

export function SoapEndpointTable({ data, meta }: SoapEndpointTableProps) {
  const router = useRouter()
  const [expandedTypeId, setExpandedTypeId] = useState<string | null>(null)
  const [search, setSearch] = useState("")
  const [deleteDialog, setDeleteDialog] = useState<{ open: boolean; id?: string; type: "type" | "method" }>({
    open: false,
    type: "type",
  })
  const [typeDialog, setTypeDialog] = useState<{ open: boolean; endpointType?: SoapEndpointType }>({
    open: false,
  })
  const [methodDialog, setMethodDialog] = useState<{
    open: boolean
    endpointTypeId?: string
    method?: SoapEndpointMethod
  }>({ open: false })
  const [loading, setLoading] = useState(false)

  const typeForm = useForm<any>({
    resolver: zodResolver(typeDialog.endpointType ? updateSoapEndpointTypeSchema : createSoapEndpointTypeSchema),
    values: typeDialog.endpointType
      ? {
          type: typeDialog.endpointType.type,
          label: typeDialog.endpointType.label,
          suffix: typeDialog.endpointType.suffix,
          active: typeDialog.endpointType.active,
        }
      : { type: "", label: "", suffix: "", active: true },
  })

  const methodForm = useForm<any>({
    resolver: zodResolver(methodDialog.method ? updateSoapEndpointMethodSchema : createSoapEndpointMethodSchema),
    values: methodDialog.method
      ? {
          endpointTypeId: methodDialog.method.endpointTypeId,
          method: methodDialog.method.method,
          label: methodDialog.method.label,
          sortOrder: methodDialog.method.sortOrder,
          active: methodDialog.method.active,
        }
      : { endpointTypeId: methodDialog.endpointTypeId || "", method: "", label: "", sortOrder: 0, active: true },
  })

  async function onTypeSubmit(data: any) {
    setLoading(true)
    const formData = new FormData()
    Object.entries(data).forEach(([key, value]) => {
      if (value !== undefined) formData.append(key, String(value))
    })

    const result = typeDialog.endpointType
      ? await updateSoapEndpointType(typeDialog.endpointType.id, formData)
      : await createSoapEndpointType(formData)

    if (result.success) {
      toast.success(typeDialog.endpointType ? "Tipo de endpoint atualizado" : "Tipo de endpoint criado")
      setTypeDialog({ open: false })
      router.refresh()
    } else {
      toast.error(result.error || "Erro ao salvar")
    }
    setLoading(false)
  }

  async function onMethodSubmit(data: any) {
    setLoading(true)
    const formData = new FormData()
    Object.entries(data).forEach(([key, value]) => {
      if (value !== undefined) formData.append(key, String(value))
    })

    const result = methodDialog.method
      ? await updateSoapEndpointMethod(methodDialog.method.id, formData)
      : await createSoapEndpointMethod(formData)

    if (result.success) {
      toast.success(methodDialog.method ? "Método atualizado" : "Método criado")
      setMethodDialog({ open: false })
      router.refresh()
    } else {
      toast.error(result.error || "Erro ao salvar")
    }
    setLoading(false)
  }

  async function handleDelete(id: string, type: "type" | "method") {
    const result =
      type === "type" ? await deleteSoapEndpointType(id) : await deleteSoapEndpointMethod(id)

    if (result.success) {
      toast.success(type === "type" ? "Tipo excluído com sucesso" : "Método excluído com sucesso")
      router.refresh()
    } else {
      toast.error(result.error || "Erro ao excluir")
    }
    setDeleteDialog({ open: false, type: "type" })
  }

  async function handleRestore(id: string, type: "type" | "method") {
    const result =
      type === "type" ? await restoreSoapEndpointType(id) : await restoreSoapEndpointMethod(id)

    if (result.success) {
      toast.success(result.success ? "Restaurado com sucesso" : "Erro ao restaurar")
      router.refresh()
    }
  }

  function handleSearch(value: string) {
    setSearch(value)
    const params = new URLSearchParams(window.location.search)
    if (value) params.set("search", value)
    else params.delete("search")
    router.push(`/admin/soap-endpoints?${params.toString()}`)
  }

  const filteredData = search
    ? data.filter((t) => t.label.toLowerCase().includes(search.toLowerCase()))
    : data

  function openMethodDialog(endpointTypeId: string, method?: SoapEndpointMethod) {
    methodForm.reset({
      endpointTypeId: method?.endpointTypeId || endpointTypeId,
      method: method?.method || "",
      label: method?.label || "",
      sortOrder: method?.sortOrder || 0,
      active: method?.active ?? true,
    })
    setMethodDialog({ open: true, endpointTypeId, method })
  }

  return (
    <>
      <PageHeader title="Endpoints SOAP" description="Gerenciar tipos de endpoint e métodos SOAP">
        <Dialog
          open={typeDialog.open}
          onOpenChange={(open) => {
            setTypeDialog({ open, endpointType: open ? typeDialog.endpointType : undefined })
            if (!open) typeForm.reset()
          }}
        >
          <DialogTrigger className="inline-flex items-center justify-center rounded-md bg-primary text-primary-foreground px-4 py-2 text-sm font-medium hover:bg-primary/90">
            <Plus className="h-4 w-4 mr-2" /> Novo Tipo
          </DialogTrigger>
          <DialogContent className="sm:max-w-[425px]">
            <DialogHeader>
              <DialogTitle>{typeDialog.endpointType ? "Editar Tipo de Endpoint" : "Novo Tipo de Endpoint"}</DialogTitle>
            </DialogHeader>
            <form onSubmit={typeForm.handleSubmit(onTypeSubmit)} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="type">Tipo</Label>
                <Input id="type" className="w-full" {...typeForm.register("type")} placeholder="Ex: NOTAFISCAL" aria-invalid={!!typeForm.formState.errors.type} />
                <FieldError errors={[typeForm.formState.errors.type]} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="label">Label</Label>
                <Input id="label" className="w-full" {...typeForm.register("label")} placeholder="Ex: Nota Fiscal" aria-invalid={!!typeForm.formState.errors.label} />
                <FieldError errors={[typeForm.formState.errors.label]} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="suffix">Suffix</Label>
                <Input id="suffix" className="w-full" {...typeForm.register("suffix")} placeholder="Ex: nota_fiscal" aria-invalid={!!typeForm.formState.errors.suffix} />
                <FieldError errors={[typeForm.formState.errors.suffix]} />
              </div>
              <div className="flex items-center gap-2">
                <Checkbox
                  id="active"
                  checked={typeForm.watch("active")}
                  onCheckedChange={(v) => typeForm.setValue("active", v === true)}
                />
                <Label htmlFor="active">Tipo ativo</Label>
              </div>
              <div className="flex items-center justify-end gap-2">
                <Button
                  type="button"
                  variant="outline"
                  disabled={loading}
                  onClick={() => { typeForm.reset(); setTypeDialog({ open: false }) }}
                >
                  Cancelar
                </Button>
                <Button type="submit" disabled={loading}>
                  {loading && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
                  Salvar
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </PageHeader>

      <div className="mb-4 relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Buscar por label..."
          value={search}
          onChange={(e) => handleSearch(e.target.value)}
          className="w-full pl-9"
        />
      </div>

      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-10" />
              <TableHead>Tipo</TableHead>
              <TableHead>Label</TableHead>
              <TableHead>Suffix</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="w-[100px]">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredData.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="h-24 text-center text-muted-foreground">
                  Nenhum tipo de endpoint encontrado.
                </TableCell>
              </TableRow>
            ) : (
              filteredData.map((endpointType) => (
                <Fragment key={endpointType.id}>
                  <TableRow
                    className="cursor-pointer"
                    onClick={() =>
                      setExpandedTypeId(expandedTypeId === endpointType.id ? null : endpointType.id)
                    }
                  >
                    <TableCell>
                      <Button variant="ghost" size="icon-sm" className="h-6 w-6">
                        {expandedTypeId === endpointType.id ? (
                          <ChevronDown className="h-4 w-4" />
                        ) : (
                          <ChevronRight className="h-4 w-4" />
                        )}
                      </Button>
                    </TableCell>
                    <TableCell className="font-medium">{endpointType.type}</TableCell>
                    <TableCell>{endpointType.label}</TableCell>
                    <TableCell>
                      <code className="rounded bg-muted px-1.5 py-0.5 text-xs">{endpointType.suffix}</code>
                    </TableCell>
                    <TableCell>
                      <Badge variant={endpointType.active ? "default" : "secondary"}>
                        {endpointType.active ? "Ativo" : "Inativo"}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <DropdownMenu>
                        <DropdownMenuTrigger
                          className="flex items-center justify-center h-8 w-8 p-0 rounded-md hover:bg-accent"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <MoreHorizontal className="h-4 w-4" />
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem
                            onClick={(e) => {
                              e.stopPropagation()
                              typeForm.reset({
                                type: endpointType.type,
                                label: endpointType.label,
                                suffix: endpointType.suffix,
                                active: endpointType.active,
                              })
                              setTypeDialog({ open: true, endpointType })
                            }}
                          >
                            <Pencil className="h-4 w-4 mr-2" /> Editar
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem
                            className="text-destructive"
                            onClick={(e) => {
                              e.stopPropagation()
                              setDeleteDialog({ open: true, id: endpointType.id, type: "type" })
                            }}
                          >
                            <Trash2 className="h-4 w-4 mr-2" /> Excluir
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                  {expandedTypeId === endpointType.id && (
                    <TableRow key={`${endpointType.id}-methods`}>
                      <TableCell colSpan={6} className="p-0">
                        <div className="bg-muted/30 p-4">
                          <div className="flex items-center justify-between mb-3">
                            <h4 className="text-sm font-medium">Métodos</h4>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => openMethodDialog(endpointType.id)}
                            >
                              <Plus className="h-3 w-3 mr-1" /> Novo Método
                            </Button>
                          </div>
                          {endpointType.methods.length === 0 ? (
                            <p className="text-sm text-muted-foreground py-2">
                              Nenhum método cadastrado para este tipo.
                            </p>
                          ) : (
                            <div className="rounded-md border bg-background">
                              <Table>
                                <TableHeader>
                                  <TableRow>
                                    <TableHead>Método</TableHead>
                                    <TableHead>Label</TableHead>
                                    <TableHead>Ordem</TableHead>
                                    <TableHead>Status</TableHead>
                                    <TableHead className="w-[100px]">Ações</TableHead>
                                  </TableRow>
                                </TableHeader>
                                <TableBody>
                                  {endpointType.methods
                                    .sort((a, b) => a.sortOrder - b.sortOrder)
                                    .map((method) => (
                                      <TableRow key={method.id}>
                                        <TableCell className="font-medium">{method.method}</TableCell>
                                        <TableCell>{method.label}</TableCell>
                                        <TableCell>{method.sortOrder}</TableCell>
                                        <TableCell>
                                          <Badge variant={method.active ? "default" : "secondary"}>
                                            {method.active ? "Ativo" : "Inativo"}
                                          </Badge>
                                        </TableCell>
                                        <TableCell>
                                          <DropdownMenu>
                                            <DropdownMenuTrigger className="flex items-center justify-center h-8 w-8 p-0 rounded-md hover:bg-accent">
                                              <MoreHorizontal className="h-4 w-4" />
                                            </DropdownMenuTrigger>
                                            <DropdownMenuContent align="end">
                                              <DropdownMenuItem
                                                onClick={() => openMethodDialog(endpointType.id, method)}
                                              >
                                                <Pencil className="h-4 w-4 mr-2" /> Editar
                                              </DropdownMenuItem>
                                              <DropdownMenuSeparator />
                                              <DropdownMenuItem
                                                className="text-destructive"
                                                onClick={() =>
                                                  setDeleteDialog({
                                                    open: true,
                                                    id: method.id,
                                                    type: "method",
                                                  })
                                                }
                                              >
                                                <Trash2 className="h-4 w-4 mr-2" /> Excluir
                                              </DropdownMenuItem>
                                            </DropdownMenuContent>
                                          </DropdownMenu>
                                        </TableCell>
                                      </TableRow>
                                    ))}
                                </TableBody>
                              </Table>
                            </div>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  )}
                </Fragment>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      <div className="flex items-center justify-between mt-4">
        <p className="text-sm text-muted-foreground">
          Total: {meta.total} registro{meta.total !== 1 ? "s" : ""}
        </p>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            disabled={meta.page <= 1}
            onClick={() => {
              const params = new URLSearchParams(window.location.search)
              params.set("page", String(meta.page - 1))
              router.push(`/admin/soap-endpoints?${params.toString()}`)
            }}
          >
            Anterior
          </Button>
          <span className="text-sm text-muted-foreground">
            Página {meta.page} de {meta.totalPages}
          </span>
          <Button
            variant="outline"
            size="sm"
            disabled={meta.page >= meta.totalPages}
            onClick={() => {
              const params = new URLSearchParams(window.location.search)
              params.set("page", String(meta.page + 1))
              router.push(`/admin/soap-endpoints?${params.toString()}`)
            }}
          >
            Próximo
          </Button>
        </div>
      </div>

      <Dialog
        open={methodDialog.open}
        onOpenChange={(open) => {
          setMethodDialog({ open, endpointTypeId: open ? methodDialog.endpointTypeId : undefined, method: open ? methodDialog.method : undefined })
          if (!open) methodForm.reset()
        }}
      >
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>
              {methodDialog.method ? "Editar Método" : "Novo Método"}
            </DialogTitle>
          </DialogHeader>
          <form onSubmit={methodForm.handleSubmit(onMethodSubmit)} className="space-y-4">
            <input type="hidden" {...methodForm.register("endpointTypeId")} />
            <div className="space-y-2">
              <Label htmlFor="method">Método</Label>
              <Input id="method" className="w-full" {...methodForm.register("method")} placeholder="Ex: GETSCHEMA" aria-invalid={!!methodForm.formState.errors.method} />
              <FieldError errors={[methodForm.formState.errors.method]} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="methodLabel">Label</Label>
              <Input id="methodLabel" className="w-full" {...methodForm.register("label")} placeholder="Ex: Obter Schema" aria-invalid={!!methodForm.formState.errors.label} />
              <FieldError errors={[methodForm.formState.errors.label]} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="sortOrder">Ordem</Label>
              <Input
                id="sortOrder"
                type="number"
                className="w-full"
                {...methodForm.register("sortOrder", { valueAsNumber: true })}
                placeholder="0"
              />
            </div>
            <div className="flex items-center gap-2">
              <Checkbox
                id="methodActive"
                checked={methodForm.watch("active")}
                onCheckedChange={(v) => methodForm.setValue("active", v === true)}
              />
              <Label htmlFor="methodActive">Método ativo</Label>
            </div>
            <div className="flex items-center justify-end gap-2">
              <Button
                type="button"
                variant="outline"
                disabled={loading}
                onClick={() => { methodForm.reset(); setMethodDialog({ open: false }) }}
              >
                Cancelar
              </Button>
              <Button type="submit" disabled={loading}>
                {loading && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
                Salvar
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={deleteDialog.open}
        onOpenChange={(open) => setDeleteDialog({ open, id: deleteDialog.id, type: deleteDialog.type })}
        title={deleteDialog.type === "type" ? "Excluir Tipo de Endpoint" : "Excluir Método"}
        description={
          deleteDialog.type === "type"
            ? "Tem certeza que deseja excluir este tipo de endpoint? Os métodos associados também serão desativados."
            : "Tem certeza que deseja excluir este método? Esta ação pode ser revertida posteriormente."
        }
        confirmLabel="Excluir"
        variant="destructive"
        onConfirm={() => deleteDialog.id && handleDelete(deleteDialog.id, deleteDialog.type)}
      />
    </>
  )
}
