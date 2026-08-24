"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { PageHeader } from "@/components/shared/page-header"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { EmptyState } from "@/components/shared/empty-state"
import { Bookmark, Trash2 } from "lucide-react"
import { toast } from "sonner"
import { formatDate } from "@/utils/format"
import { deleteSoapTemplate } from "@/actions/soap"

export type TemplateItem = {
  id: string
  name: string
  description: string | null
  dataserver: string | null
  process: string | null
  method: string | null
  createdAt: Date
}

export function SoapTemplatesClient({ templates }: { templates: TemplateItem[] }) {
  const router = useRouter()
  const [removingId, setRemovingId] = useState<string | null>(null)

  async function handleDelete(id: string) {
    setRemovingId(id)
    const result = await deleteSoapTemplate(id)
    if (result.success) {
      toast.success("Template removido")
      router.refresh()
    } else {
      toast.error(result.error || "Erro ao remover template")
    }
    setRemovingId(null)
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
                {template.description && (
                  <p className="text-xs text-muted-foreground mb-2">{template.description}</p>
                )}
                <div className="flex items-center gap-2 mb-2">
                  {template.dataserver && <Badge variant="outline" className="text-xs">{template.dataserver}</Badge>}
                  {template.method && <Badge variant="outline" className="text-xs">{template.method}</Badge>}
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-xs text-muted-foreground">{formatDate(template.createdAt)}</span>
                  <Button
                    variant="ghost"
                    size="icon"
                    disabled={removingId === template.id}
                    onClick={() => handleDelete(template.id)}
                  >
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
