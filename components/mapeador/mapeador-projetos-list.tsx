"use client"

import { useEffect, useRef, useState } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { Plus, FolderKanban, Trash2, Upload, Loader2, Sparkles, FilePlus2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Checkbox } from "@/components/ui/checkbox"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Card, CardContent, CardFooter, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog"
import { DataTableToolbar } from "@/components/shared/data-table-toolbar"
import { DataTableFilterPanel } from "@/components/shared/data-table-filter-panel"
import { ColorBadge } from "@/components/shared/color-badge"
import {
  createMapeadorProjeto,
  createMapeadorProjetosFromTemplates,
  deleteMapeadorProjeto,
  importMapeadorProjeto,
  listClientesParaMapeador,
} from "@/actions/mapeador"
import { deleteMapeadorTemplateModelo } from "@/actions/mapeador-template"
import { useHasPermission } from "@/hooks/use-permissions"
import { cn } from "@/lib/utils"
import type { MapeadorProjetoSummary, MapeadorTemplateSummary } from "@/types/mapeador"

interface ClienteOption {
  id: string
  name: string
  color: string
}

function normalize(value: string) {
  return value
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
}

type DialogStep = "closed" | "choice" | "templates" | "blank"

interface MapeadorProjetosListProps {
  initialProjetos: MapeadorProjetoSummary[]
  templates: MapeadorTemplateSummary[]
}

export function MapeadorProjetosList({ initialProjetos, templates }: MapeadorProjetosListProps) {
  const router = useRouter()
  const [projetos, setProjetos] = useState(initialProjetos)
  const [templateList, setTemplateList] = useState(templates)
  const [step, setStep] = useState<DialogStep>("closed")
  const [nome, setNome] = useState("")
  const [selectedTemplateIds, setSelectedTemplateIds] = useState<Set<string>>(() => new Set(templates.map((t) => t.id)))
  const rubeusTemplates = templateList.filter((t) => t.origem === "rubeus")
  const meusModelos = templateList.filter((t) => t.origem === "modelo")
  const [loading, setLoading] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const canCreate = useHasPermission("mapeador_projetos", "create")
  const canDelete = useHasPermission("mapeador_projetos", "delete")

  const [clientes, setClientes] = useState<ClienteOption[]>([])
  const [dialogClienteId, setDialogClienteId] = useState<string | null>(null)
  const [searchTerm, setSearchTerm] = useState("")
  const [filtersOpen, setFiltersOpen] = useState(false)
  const [clienteFilter, setClienteFilter] = useState("")
  const [formaIngressoFilter, setFormaIngressoFilter] = useState("")

  useEffect(() => {
    listClientesParaMapeador().then((data) => setClientes(data as ClienteOption[]))
  }, [])

  function openChoice() {
    setNome("")
    setDialogClienteId(null)
    setSelectedTemplateIds(new Set(templateList.filter((t) => t.origem === "rubeus").map((t) => t.id)))
    setStep("choice")
  }

  function toggleTemplate(id: string, checked: boolean) {
    setSelectedTemplateIds((prev) => {
      const next = new Set(prev)
      if (checked) next.add(id)
      else next.delete(id)
      return next
    })
  }

  async function handleCreateBlank() {
    if (!nome.trim()) return
    setLoading(true)
    try {
      const result = await createMapeadorProjeto(nome.trim(), dialogClienteId)
      if (!result.success) {
        toast.error(result.error || "Erro ao criar projeto")
        return
      }
      setStep("closed")
      router.push(`/projetos/mapeador/${result.data.id}`)
    } finally {
      setLoading(false)
    }
  }

  async function handleCreateFromTemplates() {
    if (selectedTemplateIds.size === 0) return
    setLoading(true)
    try {
      const result = await createMapeadorProjetosFromTemplates(Array.from(selectedTemplateIds), dialogClienteId)
      if (!result.success) {
        toast.error(result.error || "Erro ao gerar os processos")
        return
      }
      setStep("closed")
      router.push(`/projetos/mapeador/${result.data[0].id}`)
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

  async function handleDeleteModelo(id: string) {
    if (!confirm("Excluir este modelo? Esta ação não pode ser desfeita.")) return
    const result = await deleteMapeadorTemplateModelo(id)
    if (!result.success) {
      toast.error(result.error || "Erro ao excluir modelo")
      return
    }
    setTemplateList((prev) => prev.filter((t) => t.id !== id))
    setSelectedTemplateIds((prev) => {
      const next = new Set(prev)
      next.delete(id)
      return next
    })
    toast.success("Modelo excluído")
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

  const formasIngresso = Array.from(new Set(projetos.map((p) => p.nome))).sort((a, b) => a.localeCompare(b, "pt-BR"))

  const filteredProjetos = projetos.filter((p) => {
    if (clienteFilter && p.cliente?.id !== clienteFilter) return false
    if (formaIngressoFilter && p.nome !== formaIngressoFilter) return false
    if (searchTerm) {
      const term = normalize(searchTerm)
      const haystack = [p.nome, p.cliente?.name, ...p.etapaNomes].filter((s): s is string => !!s).map(normalize)
      if (!haystack.some((h) => h.includes(term))) return false
    }
    return true
  })

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Mapeador de Experiências</h1>
        <p className="text-sm text-muted-foreground">Mapeie as etapas, campos e o fluxo de fichas de inscrição e matrícula.</p>
      </div>

      <DataTableToolbar
        searchable
        searchPlaceholder="Buscar por forma de ingresso, cliente ou etapa..."
        onSearch={setSearchTerm}
        hasFilterPanel
        filtersOpen={filtersOpen}
        onToggleFilters={() => setFiltersOpen((v) => !v)}
        toolbarActions={
          <>
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
              <Button onClick={openChoice}>
                <Plus className="h-4 w-4" /> Novo projeto
              </Button>
            )}
          </>
        }
      />

      {filtersOpen && (
        <DataTableFilterPanel
          onApply={() => setFiltersOpen(false)}
          onClear={() => {
            setClienteFilter("")
            setFormaIngressoFilter("")
            setFiltersOpen(false)
          }}
        >
          <div className="space-y-2">
            <Label>Cliente</Label>
            <Select
              items={[{ value: "all", label: "Todos" }, ...clientes.map((c) => ({ value: c.id, label: c.name }))]}
              value={clienteFilter || "all"}
              onValueChange={(v) => setClienteFilter(v === "all" ? "" : (v as string))}
            >
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Todos" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos</SelectItem>
                {clientes.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Forma de ingresso</Label>
            <Select
              items={[{ value: "all", label: "Todas" }, ...formasIngresso.map((nome) => ({ value: nome, label: nome }))]}
              value={formaIngressoFilter || "all"}
              onValueChange={(v) => setFormaIngressoFilter(v === "all" ? "" : (v as string))}
            >
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Todas" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas</SelectItem>
                {formasIngresso.map((nome) => (
                  <SelectItem key={nome} value={nome}>
                    {nome}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </DataTableFilterPanel>
      )}

      <Dialog open={step === "choice"} onOpenChange={(open) => !open && setStep("closed")}>
        <DialogContent className="h-auto max-h-[90vh] sm:max-w-4xl">
          <DialogHeader>
            <DialogTitle>Novo projeto</DialogTitle>
            <DialogDescription>Como você quer começar este mapeamento?</DialogDescription>
          </DialogHeader>
          <DialogBody className="grid gap-4 sm:grid-cols-2">
            <Card
              role="button"
              tabIndex={0}
              onClick={() => setStep("templates")}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault()
                  setStep("templates")
                }
              }}
              className="h-full cursor-pointer transition-colors hover:ring-primary/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
            >
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="flex items-center gap-2">
                    <Sparkles className="h-4 w-4 text-primary" /> Usar o padrão Rubeus
                  </CardTitle>
                  <Badge>Recomendado</Badge>
                </div>
                <CardDescription>
                  Começa com as formas de ingresso já mapeadas conforme o modelo padrão: etapas, passos, campos, botões e
                  feedbacks. Depois você ajusta o que muda para este cliente.
                </CardDescription>
              </CardHeader>
              <CardContent className="flex-1" />
              <CardFooter>
                <Button className="w-full" onClick={() => setStep("templates")}>
                  Escolher formas de ingresso
                </Button>
              </CardFooter>
            </Card>
            <Card
              role="button"
              tabIndex={0}
              onClick={() => setStep("blank")}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault()
                  setStep("blank")
                }
              }}
              className="h-full cursor-pointer transition-colors hover:ring-primary/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
            >
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <FilePlus2 className="h-4 w-4" /> Criar do zero
                </CardTitle>
                <CardDescription>
                  Começa com um processo em branco, para mapear uma ficha que não segue o padrão. Você monta as etapas, os
                  passos e os campos manualmente.
                </CardDescription>
              </CardHeader>
              <CardContent className="flex-1" />
              <CardFooter>
                <Button variant="outline" className="w-full" onClick={() => setStep("blank")}>
                  Criar processo em branco
                </Button>
              </CardFooter>
            </Card>
          </DialogBody>
        </DialogContent>
      </Dialog>

      <Dialog open={step === "templates"} onOpenChange={(open) => !open && setStep("closed")}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Padrão Rubeus</DialogTitle>
            <DialogDescription>
              Selecione as formas de ingresso que este cliente vai usar. Cada uma vira um processo já mapeado, pronto para
              ajustar na reunião.
            </DialogDescription>
          </DialogHeader>
          <DialogBody className="space-y-4">
            <div className="space-y-2">
              <Label>Cliente (opcional)</Label>
              <Select
                items={[{ value: "none", label: "Nenhum cliente" }, ...clientes.map((c) => ({ value: c.id, label: c.name }))]}
                value={dialogClienteId ?? "none"}
                onValueChange={(v) => setDialogClienteId(v === "none" ? null : (v as string))}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Nenhum cliente" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Nenhum cliente</SelectItem>
                  {clientes.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              {rubeusTemplates.map((template) => (
                <Label
                  key={template.id}
                  className={cn(
                    "flex cursor-pointer items-center gap-3 rounded-lg border p-3 font-normal",
                    selectedTemplateIds.has(template.id) && "border-primary"
                  )}
                >
                  <Checkbox
                    checked={selectedTemplateIds.has(template.id)}
                    onCheckedChange={(checked) => toggleTemplate(template.id, !!checked)}
                  />
                  <div>
                    <p className="font-semibold">{template.nome}</p>
                    <p className="text-xs text-muted-foreground">
                      {template.etapasCount} etapas · {template.itensCount} itens
                    </p>
                  </div>
                </Label>
              ))}
            </div>

            {meusModelos.length > 0 && (
              <div className="space-y-2">
                <p className="text-xs font-semibold uppercase text-muted-foreground">Meus modelos</p>
                {meusModelos.map((template) => (
                  <Label
                    key={template.id}
                    className={cn(
                      "flex cursor-pointer items-center gap-3 rounded-lg border p-3 font-normal",
                      selectedTemplateIds.has(template.id) && "border-primary"
                    )}
                  >
                    <Checkbox
                      checked={selectedTemplateIds.has(template.id)}
                      onCheckedChange={(checked) => toggleTemplate(template.id, !!checked)}
                    />
                    <div className="min-w-0 flex-1">
                      <p className="font-semibold">{template.nome}</p>
                      <p className="text-xs text-muted-foreground">
                        {template.etapasCount} etapas · {template.itensCount} itens
                      </p>
                    </div>
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      onClick={(e) => {
                        e.preventDefault()
                        e.stopPropagation()
                        handleDeleteModelo(template.id)
                      }}
                    >
                      <Trash2 className="h-3.5 w-3.5 text-destructive" />
                    </Button>
                  </Label>
                ))}
              </div>
            )}
          </DialogBody>
          <DialogFooter>
            <Button variant="outline" onClick={() => setStep("choice")}>
              Voltar
            </Button>
            <Button onClick={handleCreateFromTemplates} disabled={loading || selectedTemplateIds.size === 0}>
              {loading && <Loader2 className="h-4 w-4 animate-spin" />} Adicionar selecionados
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={step === "blank"} onOpenChange={(open) => !open && setStep("closed")}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Criar processo em branco</DialogTitle>
          </DialogHeader>
          <DialogBody className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="nome">Nome do processo</Label>
              <Input
                id="nome"
                value={nome}
                onChange={(e) => setNome(e.target.value)}
                placeholder="Ex: Vestibular Presencial"
                onKeyDown={(e) => e.key === "Enter" && handleCreateBlank()}
                autoFocus
              />
            </div>
            <div className="space-y-2">
              <Label>Cliente (opcional)</Label>
              <Select
                items={[{ value: "none", label: "Nenhum cliente" }, ...clientes.map((c) => ({ value: c.id, label: c.name }))]}
                value={dialogClienteId ?? "none"}
                onValueChange={(v) => setDialogClienteId(v === "none" ? null : (v as string))}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Nenhum cliente" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Nenhum cliente</SelectItem>
                  {clientes.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </DialogBody>
          <DialogFooter>
            <Button variant="outline" onClick={() => setStep("choice")}>
              Voltar
            </Button>
            <Button onClick={handleCreateBlank} disabled={loading || !nome.trim()}>
              {loading && <Loader2 className="h-4 w-4 animate-spin" />} Criar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {projetos.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            Nenhum projeto mapeado ainda. Clique em &quot;Novo projeto&quot; para começar.
          </CardContent>
        </Card>
      ) : filteredProjetos.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            Nenhum projeto encontrado para os filtros aplicados.
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filteredProjetos.map((projeto) => (
            <Card key={projeto.id} className="group relative cursor-pointer hover:border-primary" onClick={() => router.push(`/projetos/mapeador/${projeto.id}`)}>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <FolderKanban className="h-4 w-4 text-primary" /> {projeto.nome}
                </CardTitle>
                <CardDescription className="flex items-center gap-2">
                  <span>{projeto.etapasCount} etapa(s)</span>
                  {projeto.cliente && <ColorBadge label={projeto.cliente.name} color={projeto.cliente.color} solid />}
                </CardDescription>
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
