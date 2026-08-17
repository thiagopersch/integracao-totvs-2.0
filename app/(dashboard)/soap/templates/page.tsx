"use client"

import { useState, useEffect } from "react"
import { PageHeader } from "@/components/shared/page-header"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { EmptyState } from "@/components/shared/empty-state"
import { Bookmark, Trash2 } from "lucide-react"
import { toast } from "sonner"
import { formatDate } from "@/utils/format"

type Template = {
  id: string
  name: string
  description?: string
  dataserver?: string
  process?: string
  method?: string
  createdAt: string
}

export default function SoapTemplatesPage() {
  const [templates, setTemplates] = useState<Template[]>([])

  useEffect(() => {
    setTemplates([
      {
        id: "1",
        name: "Consulta Aluno",
        description: "Template para consultar dados do aluno",
        dataserver: "RM",
        process: "CONSULTA_ALUNO",
        method: "READRECORD",
        createdAt: new Date().toISOString(),
      },
    ])
  }, [])

  async function handleDelete(id: string) {
    setTemplates((prev) => prev.filter((t) => t.id !== id))
    toast.success("Template removido")
  }

  return (
    <div className="p-6">
      <PageHeader title="Templates SOAP" description="Templates de requisições SOAP salvos" />
      {templates.length === 0 ? (
        <EmptyState
          icon={Bookmark}
          title="Nenhum template"
          description="Salve requisições como templates para reutilizar depois"
        />
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {templates.map((template) => (
            <Card key={template.id}>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">{template.name}</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-xs text-muted-foreground mb-2">{template.description}</p>
                <div className="flex items-center gap-2 mb-2">
                  <Badge variant="outline" className="text-xs">{template.dataserver}</Badge>
                  <Badge variant="outline" className="text-xs">{template.method}</Badge>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-xs text-muted-foreground">{formatDate(template.createdAt)}</span>
                  <Button variant="ghost" size="icon" onClick={() => handleDelete(template.id)}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
