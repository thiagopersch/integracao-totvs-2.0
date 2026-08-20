"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { PageHeader } from "@/components/shared/page-header"
import { ConfirmDialog } from "@/components/shared/confirm-dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Field, FieldLabel, FieldError } from "@/components/ui/field"
import { Badge } from "@/components/ui/badge"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
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
import { MoreHorizontal, Plus, Trash2, Pencil, Loader2 } from "lucide-react"
import { deleteTag, createTag, updateTag } from "@/actions/tags"
import { createTagSchema, updateTagSchema } from "@/schemas/tag.schema"
import { toast } from "sonner"
import type { Tag } from "@prisma/client"

interface TagTableProps {
  data: Tag[]
}

export function TagTable({ data }: TagTableProps) {
  const router = useRouter()
  const [deleteDialog, setDeleteDialog] = useState<{ open: boolean; id?: string }>({ open: false })
  const [editDialog, setEditDialog] = useState<{ open: boolean; tag?: Tag }>({ open: false })
  const [loading, setLoading] = useState(false)

  const form = useForm<any>({
    resolver: zodResolver(editDialog.tag ? updateTagSchema : createTagSchema),
    values: editDialog.tag ? { name: editDialog.tag.name, color: editDialog.tag.color } : { name: "", color: "#8b5cf6" },
  })

  async function onSubmit(data: any) {
    setLoading(true)
    const formData = new FormData()
    Object.entries(data).forEach(([key, value]) => {
      if (value !== undefined) formData.append(key, String(value))
    })

    const result = editDialog.tag ? await updateTag(editDialog.tag.id, formData) : await createTag(formData)

    if (result.success) {
      toast.success(editDialog.tag ? "Tag atualizada" : "Tag criada")
      form.reset()
      setEditDialog({ open: false })
      router.refresh()
    } else {
      toast.error(result.error || "Erro ao salvar")
    }
    setLoading(false)
  }

  function handleCancel() {
    form.reset()
    setEditDialog({ open: false })
  }

  async function handleDelete(id: string) {
    const result = await deleteTag(id)
    if (result.success) {
      toast.success("Tag excluída com sucesso")
      router.refresh()
    } else {
      toast.error(result.error || "Erro ao excluir")
    }
    setDeleteDialog({ open: false })
  }

  return (
    <>
      <PageHeader title="Tags" description="Gerenciar tags de demandas">
        <Dialog
          open={editDialog.open}
          onOpenChange={(open) => { setEditDialog({ open, tag: open ? editDialog.tag : undefined }); if (!open) form.reset() }}
        >
          <DialogTrigger className="inline-flex items-center justify-center rounded-md bg-primary text-primary-foreground px-4 py-2 text-sm font-medium hover:bg-primary/90">
            <Plus className="h-4 w-4 mr-2" /> Nova Tag
          </DialogTrigger>
          <DialogContent className="sm:max-w-[400px]">
            <DialogHeader>
              <DialogTitle>{editDialog.tag ? "Editar Tag" : "Nova Tag"}</DialogTitle>
            </DialogHeader>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <Field>
                <FieldLabel htmlFor="name">Nome</FieldLabel>
                <Input id="name" {...form.register("name")} placeholder="Nome da tag" aria-invalid={!!form.formState.errors.name} />
                <FieldError errors={[form.formState.errors.name]} />
              </Field>
              <Field>
                <FieldLabel htmlFor="color">Cor</FieldLabel>
                <Input id="color" type="color" className="h-10 w-20 p-1" {...form.register("color")} />
                <FieldError errors={[form.formState.errors.color]} />
              </Field>
              <div className="flex items-center justify-end gap-2">
                <Button type="button" variant="outline" onClick={handleCancel} disabled={loading}>Cancelar</Button>
                <Button type="submit" disabled={loading}>
                  {loading && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
                  Salvar
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </PageHeader>

      <div className="px-6 pb-6">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nome</TableHead>
              <TableHead className="w-12" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {data.map((tag) => (
              <TableRow key={tag.id}>
                <TableCell>
                  <Badge style={{ backgroundColor: `${tag.color}22`, borderColor: tag.color, color: tag.color }} variant="outline">
                    {tag.name}
                  </Badge>
                </TableCell>
                <TableCell>
                  <DropdownMenu>
                    <DropdownMenuTrigger className="flex items-center justify-center h-8 w-8 p-0 rounded-md hover:bg-accent">
                      <MoreHorizontal className="h-4 w-4" />
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={() => setEditDialog({ open: true, tag })}>
                        <Pencil className="h-4 w-4 mr-2" /> Editar
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem className="text-destructive" onClick={() => setDeleteDialog({ open: true, id: tag.id })}>
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

      <ConfirmDialog
        open={deleteDialog.open}
        onOpenChange={(open) => setDeleteDialog({ open, id: deleteDialog.id })}
        title="Excluir Tag"
        description="Tem certeza que deseja excluir esta tag?"
        confirmLabel="Excluir"
        variant="destructive"
        onConfirm={() => deleteDialog.id && handleDelete(deleteDialog.id)}
      />
    </>
  )
}
