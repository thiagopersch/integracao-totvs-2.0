"use client"

import { useRef, useState } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { Plus, FolderKanban, Trash2, Upload, Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { createMapeadorProjeto, deleteMapeadorProjeto, importMapeadorProjeto } from "@/actions/mapeador"
import { useHasPermission } from "@/hooks/use-permissions"
import type { MapeadorProjetoSummary } from "@/types/mapeador"

interface MapeadorProjetosListProps {
  initialProjetos: MapeadorProjetoSummary[]
}

export function MapeadorProjetosList({ initialProjetos }: MapeadorProjetosListProps) {
  const router = useRouter()
  const [projetos, setProjetos] = useState(initialProjetos)
  const [createOpen, setCreateOpen] = useState(false)
  const [nome, setNome] = useState("")
  const [loading, setLoading] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const canCreate = useHasPermission("mapeador_projetos", "create")
  const canDelete = useHasPermission("mapeador_projetos", "delete")

  async function handleCreate() {
    if (!nome.trim()) return
    setLoading(true)
    try {
      const result = await createMapeadorProjeto(nome.trim())
      if (!result.success) {
        toast.error(result.error || "Erro ao criar projeto")
        return
      }
      setCreateOpen(false)
      setNome("")
      router.push(`/projetos/mapeador/${result.data.id}`)
    } finally {
      setLoading(false)
    }
  }

  async function handleDelete(id: string) {
    if (!confirm("Excluir este projeto mapeado? Esta ação não pode ser desfeita.")) return
    const result = await deleteMapeadorProjeto(id)
    if (!result.success) {
      toast.error(result.error || "Erro ao excluir projeto")
      return
    }
    setProjetos((prev) => prev.filter((p) => p.id !== id))
    toast.success("Projeto excluído")
  }

  async function handleImport(file: File) {
    const text = await file.text()
    const result = await importMapeadorProjeto(text)
    if (!result.success) {
      toast.error(result.error || "Erro ao importar JSON")
      return
    }
    router.push(`/projetos/mapeador/${result.data.id}`)
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Mapeador de Experiências</h1>
          <p className="text-sm text-muted-foreground">Mapeie as etapas, campos e o fluxo de fichas de inscrição e matrícula.</p>
        </div>
        <div className="flex gap-2">
          <input
            ref={fileInputRef}
            type="file"
            accept="application/json"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0]
              if (file) handleImport(file)
              e.target.value = ""
            }}
          />
          <Button variant="outline" type="button" onClick={() => fileInputRef.current?.click()}>
            <Upload className="h-4 w-4" /> Importar JSON
          </Button>
          {canCreate && (
            <Dialog open={createOpen} onOpenChange={setCreateOpen}>
              <DialogTrigger
                render={
                  <Button>
                    <Plus className="h-4 w-4" /> Novo projeto
                  </Button>
                }
              />
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Criar processo em branco</DialogTitle>
                </DialogHeader>
                <DialogBody className="space-y-2">
                  <Label htmlFor="nome">Nome do processo</Label>
                  <Input
                    id="nome"
                    value={nome}
                    onChange={(e) => setNome(e.target.value)}
                    placeholder="Ex: Vestibular Presencial"
                    onKeyDown={(e) => e.key === "Enter" && handleCreate()}
                  />
                </DialogBody>
                <DialogFooter>
                  <Button onClick={handleCreate} disabled={loading || !nome.trim()}>
                    {loading && <Loader2 className="h-4 w-4 animate-spin" />} Criar
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          )}
        </div>
      </div>

      {projetos.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            Nenhum projeto mapeado ainda. Clique em &quot;Novo projeto&quot; para começar.
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {projetos.map((projeto) => (
            <Card key={projeto.id} className="group relative cursor-pointer hover:border-primary" onClick={() => router.push(`/projetos/mapeador/${projeto.id}`)}>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <FolderKanban className="h-4 w-4 text-primary" /> {projeto.nome}
                </CardTitle>
                <CardDescription>{projeto.etapasCount} etapa(s)</CardDescription>
              </CardHeader>
              <CardContent className="flex items-center justify-between text-xs text-muted-foreground">
                <span>Atualizado em {new Date(projeto.updatedAt).toLocaleDateString("pt-BR")}</span>
                {canDelete && (
                  <Button
                    variant="ghost"
                    size="icon"
                    className="opacity-0 group-hover:opacity-100"
                    onClick={(e) => {
                      e.stopPropagation()
                      handleDelete(projeto.id)
                    }}
                  >
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
