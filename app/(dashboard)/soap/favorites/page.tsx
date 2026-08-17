"use client"

import { useState, useEffect } from "react"
import { PageHeader } from "@/components/shared/page-header"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { EmptyState } from "@/components/shared/empty-state"
import { Star, Trash2, Play } from "lucide-react"
import { toast } from "sonner"
import { formatDate } from "@/utils/format"

type Favorite = {
  id: string
  name: string
  dataserver?: string
  process?: string
  method?: string
  createdAt: string
}

export default function SoapFavoritesPage() {
  const [favorites, setFavorites] = useState<Favorite[]>([])

  useEffect(() => {
    setFavorites([
      {
        id: "1",
        name: "GETSCHEMA - RM",
        dataserver: "RM",
        process: "CONSULTA_ALUNO",
        method: "GETSCHEMA",
        createdAt: new Date().toISOString(),
      },
    ])
  }, [])

  async function handleRemove(id: string) {
    setFavorites((prev) => prev.filter((f) => f.id !== id))
    toast.success("Removido dos favoritos")
  }

  return (
    <div className="p-6">
      <PageHeader title="Favoritos SOAP" description="Chamadas SOAP favoritas" />
      {favorites.length === 0 ? (
        <EmptyState
          icon={Star}
          title="Nenhum favorito"
          description="Marque chamadas como favoritas para acesso rápido"
        />
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {favorites.map((fav) => (
            <Card key={fav.id}>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">{fav.name}</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex items-center gap-2 mb-2">
                  <Badge variant="outline" className="text-xs">{fav.dataserver}</Badge>
                  <Badge variant="outline" className="text-xs">{fav.method}</Badge>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-xs text-muted-foreground">{formatDate(fav.createdAt)}</span>
                  <div className="flex items-center gap-1">
                    <Button variant="ghost" size="icon">
                      <Play className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="icon" onClick={() => handleRemove(fav.id)}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
